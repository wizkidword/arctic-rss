import { createServer, Socket, type Server } from "node:net"
import { once } from "node:events"

import { afterEach, describe, expect, it } from "vitest"

import { createExternalIrcSession, type ExternalIrcSession } from "./session"

describe("controlled external IRC server integration", () => {
  let server: Server | undefined
  let client: Socket | undefined

  afterEach(async () => {
    client?.end()
    if (server) {
      await new Promise<void>((resolve) => server?.close(() => resolve()))
    }
    client = undefined
    server = undefined
  })

  it("performs a local handshake and ping round-trip without a public target", async () => {
    const lines: string[] = []
    const connected = new Promise<Socket>((resolve) => {
      const controlledServer = createServer((socket) => {
        socket.on("error", () => {})
        socket.on("data", (chunk) => {
          lines.push(...chunk.toString("utf8").split("\r\n").filter(Boolean))
          if (lines.includes("USER arctic 0 * :ArcticIRC")) {
            socket.write(":controlled 001 arcticowner :Welcome\r\nPING :loopback-token\r\n")
          }
        })
        resolve(socket)
      })
      server = controlledServer
    })
    const controlledServer = server
    if (!controlledServer) {
      throw new Error("Controlled IRC server was not created.")
    }
    controlledServer.listen(0, "127.0.0.1")
    await once(controlledServer, "listening")
    const address = controlledServer.address()
    if (!address || typeof address === "string") {
      throw new Error("Controlled IRC server did not bind a TCP port.")
    }

    client = await new Promise<Socket>((resolve, reject) => {
      const socket = new Socket()
      socket.on("error", () => {})
      socket.once("connect", () => resolve(socket))
      socket.once("error", reject)
      socket.connect(address.port, "127.0.0.1")
    })

    const events: string[] = []
    const session: ExternalIrcSession = createExternalIrcSession({
      nickname: "arcticowner",
      onEvent: (event) => events.push(event.type),
      transport: {
        close: () => client?.end(),
        write: (line) => client?.write(line),
      },
    })
    client.on("data", (chunk) => session.receive(chunk.toString("utf8")))

    session.start()
    await connected
    await waitFor(() => lines.includes("PONG :loopback-token"))

    expect(lines).toEqual(expect.arrayContaining([
      "CAP LS 302",
      "NICK arcticowner",
      "USER arctic 0 * :ArcticIRC",
      "PONG :loopback-token",
    ]))
    expect(events).toEqual(expect.arrayContaining(["connected", "message"]))
  })
})

async function waitFor(condition: () => boolean) {
  for (let index = 0; index < 20; index += 1) {
    if (condition()) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error("Timed out waiting for the controlled IRC server.")
}

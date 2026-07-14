import { io as createSocketClient } from "socket.io-client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { createChatGateway, type ChatGateway } from "./gateway"

const logger = {
  info: vi.fn(),
  warn: vi.fn(),
}

describe("chat gateway", () => {
  let gateway: ChatGateway | undefined

  afterEach(async () => {
    await gateway?.close()
    gateway = undefined
    vi.clearAllMocks()
  })

  it("accepts an authenticated WebSocket client and exposes health probes", async () => {
    gateway = createChatGateway({
      authenticateConnection: async ({ token }) => {
        if (token !== "valid-token") {
          throw new Error("invalid")
        }

        return {
          handle: "northernlights",
          profileId: "profile-1",
          role: "USER",
          userId: "user-1",
        }
      },
      logger,
    })
    const port = await gateway.start(0)
    const live = await fetch(`http://127.0.0.1:${port}/live`)
    const ready = await fetch(`http://127.0.0.1:${port}/ready`)

    expect(await live.json()).toEqual({ status: "ok" })
    expect(await ready.json()).toEqual({ status: "ok" })

    const client = createSocketClient(`ws://127.0.0.1:${port}`, {
      auth: { token: "valid-token" },
      forceNew: true,
      transports: ["websocket"],
    })

    const session = await new Promise<unknown>((resolve, reject) => {
      client.once("session:ready", resolve)
      client.once("connect_error", reject)
    })

    expect(session).toEqual({
      handle: "northernlights",
      profileId: "profile-1",
      role: "USER",
    })
    client.disconnect()
  })
})

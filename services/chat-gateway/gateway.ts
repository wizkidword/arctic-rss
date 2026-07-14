import {
  createServer,
  type IncomingMessage,
  type Server as HttpServer,
  type ServerResponse,
} from "node:http"
import type { AddressInfo } from "node:net"

import { Server } from "socket.io"

import type { ChatGatewayIdentity } from "../../src/lib/chat/gateway-auth"
import type { ChatGatewayLogger } from "./logger"

export type ChatGatewayAuthenticator = (input: {
  origin: string | undefined
  token: unknown
}) => Promise<ChatGatewayIdentity>

export type ChatGateway = {
  close: () => Promise<void>
  httpServer: HttpServer
  io: Server
  start: (port: number) => Promise<number>
}

export function createChatGateway({
  authenticateConnection,
  configureIo,
  logger,
  readiness = async () => {},
}: {
  authenticateConnection: ChatGatewayAuthenticator
  configureIo?: (io: Server) => void
  logger: ChatGatewayLogger
  readiness?: () => Promise<void>
}): ChatGateway {
  const httpServer = createServer((request, response) => {
    void handleHealthRequest(request, response, readiness)
  })
  const io = new Server(httpServer, {
    // WebSocket-only avoids long-polling sticky-session requirements when the
    // gateway is scaled horizontally behind the Redis adapter.
    transports: ["websocket"],
  })

  configureIo?.(io)

  io.use(async (socket, next) => {
    try {
      const identity = await authenticateConnection({
        origin: socket.handshake.headers.origin,
        token: socket.handshake.auth?.token,
      })

      socket.data.chat = identity
      next()
    } catch {
      logger.warn("connection_rejected")
      next(new Error("unauthorized"))
    }
  })

  io.on("connection", (socket) => {
    const identity = socket.data.chat as ChatGatewayIdentity

    logger.info("connection_accepted", { connectionId: socket.id })
    socket.emit("session:ready", {
      handle: identity.handle,
      profileId: identity.profileId,
      role: identity.role,
    })
    socket.on("disconnect", () => {
      logger.info("connection_closed", { connectionId: socket.id })
    })
  })

  return {
    close: () => closeGateway(io, httpServer),
    httpServer,
    io,
    start: (port) => startGateway(httpServer, port),
  }
}

async function handleHealthRequest(
  request: IncomingMessage,
  response: ServerResponse,
  readiness: () => Promise<void>
) {
  const path = new URL(request.url ?? "/", "http://localhost").pathname

  if (request.method !== "GET") {
    response.writeHead(405, { Allow: "GET", "Cache-Control": "no-store" })
    response.end()
    return
  }

  if (path === "/live") {
    sendJson(response, 200, { status: "ok" })
    return
  }

  if (path === "/ready") {
    try {
      await readiness()
      sendJson(response, 200, { status: "ok" })
    } catch {
      sendJson(response, 503, { status: "unavailable" })
    }
    return
  }

  sendJson(response, 404, { error: "Not found." })
}

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown
) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  })
  response.end(JSON.stringify(body))
}

function startGateway(server: HttpServer, port: number) {
  return new Promise<number>((resolve, reject) => {
    const onError = (error: Error) => {
      server.off("listening", onListening)
      reject(error)
    }
    const onListening = () => {
      server.off("error", onError)
      const address = server.address()
      resolve(typeof address === "object" && address ? (address as AddressInfo).port : port)
    }

    server.once("error", onError)
    server.once("listening", onListening)
    server.listen(port, "0.0.0.0")
  })
}

function closeGateway(io: Server, server: HttpServer) {
  return new Promise<void>((resolve, reject) => {
    io.close(() => {
      server.close((error) => {
        if (error && (error as NodeJS.ErrnoException).code !== "ERR_SERVER_NOT_RUNNING") {
          reject(error)
          return
        }

        resolve()
      })
    })
  })
}

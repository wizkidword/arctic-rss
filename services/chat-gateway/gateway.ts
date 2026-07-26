import {
  createServer,
  type IncomingMessage,
  type Server as HttpServer,
  type ServerResponse,
} from "node:http"
import type { AddressInfo } from "node:net"

import { Server, type Socket } from "socket.io"

import type { ChatGatewayIdentity } from "../../src/lib/chat/gateway-auth"
import type { ChatGatewayLogger } from "./logger"

export type ChatGatewayAuthenticator = (input: {
  origin: string | undefined
  token: unknown
}) => Promise<ChatGatewayIdentity>

export type ChatGateway = {
  close: () => Promise<void>
  disconnectUser: (userId: string, reason: string) => number
  httpServer: HttpServer
  io: Server
  start: (port: number) => Promise<number>
}

export function createChatGateway({
  authenticateConnection,
  authorizationMaxAgeMs = 60_000,
  authorizationRecheckIntervalMs = Math.min(30_000, authorizationMaxAgeMs),
  configureIo,
  isConnectionReady = () => true,
  logger,
  readiness = async () => {},
  revalidateAuthorization,
}: {
  authenticateConnection: ChatGatewayAuthenticator
  authorizationMaxAgeMs?: number
  authorizationRecheckIntervalMs?: number
  configureIo?: (io: Server) => void
  isConnectionReady?: () => boolean
  logger: ChatGatewayLogger
  readiness?: () => Promise<void>
  revalidateAuthorization?: (identity: ChatGatewayIdentity) => Promise<ChatGatewayIdentity>
}): ChatGateway {
  const socketsByUser = new Map<string, Set<Socket>>()
  let activeSockets = 0
  let forcedSecurityDisconnects = 0
  let staleAuthorizationDisconnects = 0
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
    if (!isConnectionReady()) {
      logger.warn("connection_rejected", { reason: "gateway_not_ready" })
      next(new Error("unavailable"))
      return
    }

    try {
      const identity = await authenticateConnection({
        origin: socket.handshake.headers.origin,
        token: socket.handshake.auth?.token,
      })

      socket.data.chat = identity
      next()
    } catch {
      logger.warn("connection_rejected", { reason: "authorization_failed" })
      next(new Error("unauthorized"))
    }
  })

  io.on("connection", (socket) => {
    const identity = socket.data.chat as ChatGatewayIdentity
    const userSockets = socketsByUser.get(identity.userId) ?? new Set<Socket>()
    userSockets.add(socket)
    socketsByUser.set(identity.userId, userSockets)
    activeSockets += 1

    logger.info("connection_accepted", {
      activeSockets: String(activeSockets),
      socketsForUser: String(userSockets.size),
    })
    socket.emit("session:ready", {
      handle: identity.handle,
      profileId: identity.profileId,
      role: identity.role,
    })
    socket.on("disconnect", () => {
      const tracked = socketsByUser.get(identity.userId)
      tracked?.delete(socket)
      if (tracked?.size === 0) {
        socketsByUser.delete(identity.userId)
      }
      activeSockets = Math.max(0, activeSockets - 1)
      logger.info("connection_closed", {
        activeSockets: String(activeSockets),
        socketsForUser: String(tracked?.size ?? 0),
      })
    })
  })

  const revalidationTimer = revalidateAuthorization
    ? setInterval(() => {
        void revalidateStaleSockets()
      }, Math.max(1_000, authorizationRecheckIntervalMs))
    : undefined
  revalidationTimer?.unref()

  async function revalidateStaleSockets() {
    if (!revalidateAuthorization) {
      return
    }

    const now = Date.now()
    const sockets = [...socketsByUser.values()].flatMap((entries) => [...entries])

    await Promise.all(
      sockets.map(async (socket) => {
        const identity = socket.data.chat as ChatGatewayIdentity
        const authorizedAt = Date.parse(identity.authorizedAt)

        if (!Number.isFinite(authorizedAt) || now - authorizedAt >= authorizationMaxAgeMs) {
          try {
            socket.data.chat = await revalidateAuthorization(identity)
          } catch {
            staleAuthorizationDisconnects += 1
            socket.disconnect(true)
            logger.warn("stale_authorization_rejected", {
              staleAuthorizationDisconnects: String(staleAuthorizationDisconnects),
            })
          }
        }
      })
    )
  }

  function disconnectUser(userId: string, reason: string) {
    const sockets = [...(socketsByUser.get(userId) ?? [])]
    for (const socket of sockets) {
      socket.disconnect(true)
    }

    forcedSecurityDisconnects += sockets.length
    logger.warn("security_disconnect", {
      forcedSecurityDisconnects: String(forcedSecurityDisconnects),
      reason,
      socketCount: String(sockets.length),
    })
    return sockets.length
  }

  return {
    close: async () => {
      if (revalidationTimer) {
        clearInterval(revalidationTimer)
      }
      await closeGateway(io, httpServer)
    },
    disconnectUser,
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

function sendJson(response: ServerResponse, status: number, body: unknown) {
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

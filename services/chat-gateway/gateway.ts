import { randomUUID } from "node:crypto"
import {
  createServer,
  type IncomingMessage,
  type Server as HttpServer,
  type ServerResponse,
} from "node:http"
import type { AddressInfo } from "node:net"
import { isIP } from "node:net"

import { Server, type Socket } from "socket.io"

import type { ChatGatewayIdentity } from "../../src/lib/chat/gateway-auth"
import {
  createChatSocketAbuseControls,
  DEFAULT_CHAT_GATEWAY_ABUSE_SETTINGS,
  type ChatGatewayAbuseSettings,
  type ChatGatewayEventLimiter,
} from "./abuse"
import type { ChatGatewayLogger } from "./logger"

export type ChatGatewayAuthenticator = (input: {
  origin: string | undefined
  token: unknown
}) => Promise<ChatGatewayIdentity>

export type ChatGateway = {
  close: () => Promise<void>
  disconnectUser: (userId: string, reason: string) => number
  getPendingAdmissionMetrics: () => {
    oldestPendingAgeMs: number
    pendingAdmissions: number
  }
  httpServer: HttpServer
  io: Server
  start: (port: number) => Promise<number>
}

export function createChatGateway({
  authenticateConnection,
  authorizationMaxAgeMs = 60_000,
  authorizationRecheckIntervalMs = Math.min(30_000, authorizationMaxAgeMs),
  abuseSettings = DEFAULT_CHAT_GATEWAY_ABUSE_SETTINGS,
  configureIo,
  isConnectionReady = () => true,
  limitChatAction = async () => true,
  logger,
  pendingAdmissionTtlMs = 10_000,
  readiness = async () => {},
  revalidateAuthorization,
}: {
  authenticateConnection: ChatGatewayAuthenticator
  authorizationMaxAgeMs?: number
  authorizationRecheckIntervalMs?: number
  abuseSettings?: ChatGatewayAbuseSettings
  configureIo?: (io: Server) => void
  isConnectionReady?: () => boolean
  limitChatAction?: ChatGatewayEventLimiter
  logger: ChatGatewayLogger
  pendingAdmissionTtlMs?: number
  readiness?: () => Promise<void>
  revalidateAuthorization?: (identity: ChatGatewayIdentity) => Promise<ChatGatewayIdentity>
}): ChatGateway {
  const socketsByUser = new Map<string, Set<Socket>>()
  const socketsByIp = new Map<string, Set<Socket>>()
  const pendingAdmissions = new Map<string, PendingAdmission>()
  const pendingAdmissionTokensByIp = new Map<string, Set<string>>()
  const pendingAdmissionTokensByUser = new Map<string, Set<string>>()
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
    maxHttpBufferSize: abuseSettings.maxEventPayloadBytes,
  })

  configureIo?.(io)

  io.use(async (socket, next) => {
    if (!isConnectionReady()) {
      logger.warn("connection_rejected", { reason: "gateway_not_ready" })
      next(new Error("unavailable"))
      return
    }

    const clientIp = getGatewayClientIp(socket)

    let connectionAllowed = false
    try {
      connectionAllowed = await limitChatAction({ action: "chat_connection", ip: clientIp })
    } catch {
      logger.warn("connection_rejected", { reason: "rate_limit_unavailable" })
      next(new Error("unavailable"))
      return
    }

    if (!connectionAllowed) {
      logger.warn("connection_rejected", { reason: "rate_limited" })
      next(new Error("rate-limited"))
      return
    }

    try {
      const identity = await authenticateConnection({
        origin: socket.handshake.headers.origin,
        token: socket.handshake.auth?.token,
      })

      const admission = reserveConnection(identity.userId, clientIp, socket)
      if (typeof admission === "string") {
        logger.warn("connection_rejected", { reason: admission })
        next(new Error("connection-limit"))
        return
      }

      socket.data.chat = identity
      socket.data.chatAdmission = admission
      bindPendingAdmissionCleanup(socket, admission.reservationToken)
      socket.data.chatAbuse = createChatSocketAbuseControls({
        clientIp,
        identity,
        limiter: limitChatAction,
        logger,
        settings: abuseSettings,
        socket,
      })
      next()
    } catch {
      const admission = socket.data.chatAdmission as ChatAdmission | undefined
      if (admission) {
        releasePendingAdmission(admission.reservationToken, "middleware_rejection")
      }
      void limitChatAction({
        action: "chat_authorization_failure",
        ip: clientIp,
      }).catch(() => {
        logger.warn("limiter_accounting_failed", {
          action: "chat_authorization_failure",
        })
      })
      logger.warn("connection_rejected", { reason: "authorization_failed" })
      next(new Error("unauthorized"))
    }
  })

  io.on("connection", (socket) => {
    const identity = socket.data.chat as ChatGatewayIdentity
    const admission = socket.data.chatAdmission as ChatAdmission | undefined
    if (!admission || !releasePendingAdmission(admission.reservationToken, "connected")) {
      logger.warn("connection_rejected", { reason: "pending_admission_expired" })
      socket.disconnect(true)
      return
    }
    const userSockets = socketsByUser.get(identity.userId) ?? new Set<Socket>()
    userSockets.add(socket)
    socketsByUser.set(identity.userId, userSockets)
    if (admission.clientIp) {
      const ipSockets = socketsByIp.get(admission.clientIp) ?? new Set<Socket>()
      ipSockets.add(socket)
      socketsByIp.set(admission.clientIp, ipSockets)
    }
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
      if (admission.clientIp) {
        const ipSockets = socketsByIp.get(admission.clientIp)
        ipSockets?.delete(socket)
        if (ipSockets?.size === 0) {
          socketsByIp.delete(admission.clientIp)
        }
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

  function reserveConnection(
    userId: string,
    clientIp: string | undefined,
    socket: Socket
  ): ChatAdmission | "ip_connection_limit" | "user_connection_limit" {
    const activeUserSockets = socketsByUser.get(userId)?.size ?? 0
    const pendingUserSockets = pendingAdmissionTokensByUser.get(userId)?.size ?? 0

    if (activeUserSockets + pendingUserSockets >= abuseSettings.maxActiveSocketsPerUser) {
      return "user_connection_limit"
    }

    if (clientIp) {
      const activeIpSockets = socketsByIp.get(clientIp)?.size ?? 0
      const pendingIpSockets = pendingAdmissionTokensByIp.get(clientIp)?.size ?? 0

      if (activeIpSockets + pendingIpSockets >= abuseSettings.maxActiveSocketsPerIp) {
        return "ip_connection_limit"
      }

    }

    const reservationToken = randomUUID()
    const pendingAdmission: PendingAdmission = {
      clientIp,
      createdAt: Date.now(),
      reservationToken,
      timeout: undefined,
      userId,
    }
    pendingAdmissions.set(reservationToken, pendingAdmission)
    addPendingAdmissionToken(pendingAdmissionTokensByUser, userId, reservationToken)
    if (clientIp) {
      addPendingAdmissionToken(pendingAdmissionTokensByIp, clientIp, reservationToken)
    }
    pendingAdmission.timeout = setTimeout(() => {
      const released = releasePendingAdmission(reservationToken, "timeout")
      if (released) {
        logger.warn("pending_admission_expired", pendingAdmissionMetricFields())
        socket.conn.close()
      }
    }, pendingAdmissionTtlMs)
    pendingAdmission.timeout.unref()
    recordPendingAdmissionMetrics("reserved")

    return { clientIp, reservationToken, userId }
  }

  function bindPendingAdmissionCleanup(socket: Socket, reservationToken: string) {
    socket.conn.once("close", () => {
      releasePendingAdmission(reservationToken, "transport_closed")
    })
    socket.once("disconnect", () => {
      releasePendingAdmission(reservationToken, "client_aborted")
    })
  }

  function releasePendingAdmission(
    reservationToken: string,
    reason:
      | "client_aborted"
      | "connected"
      | "middleware_rejection"
      | "server_shutdown"
      | "timeout"
      | "transport_closed"
  ) {
    const pendingAdmission = pendingAdmissions.get(reservationToken)
    if (!pendingAdmission) {
      return false
    }

    pendingAdmissions.delete(reservationToken)
    clearTimeout(pendingAdmission.timeout)
    removePendingAdmissionToken(
      pendingAdmissionTokensByUser,
      pendingAdmission.userId,
      reservationToken
    )
    if (pendingAdmission.clientIp) {
      removePendingAdmissionToken(
        pendingAdmissionTokensByIp,
        pendingAdmission.clientIp,
        reservationToken
      )
    }

    recordPendingAdmissionMetrics(reason)
    return true
  }

  function releaseAllPendingAdmissions() {
    for (const reservationToken of [...pendingAdmissions.keys()]) {
      releasePendingAdmission(reservationToken, "server_shutdown")
    }
  }

  function getPendingAdmissionMetrics() {
    let oldestPendingAgeMs = 0
    const now = Date.now()
    for (const admission of pendingAdmissions.values()) {
      oldestPendingAgeMs = Math.max(oldestPendingAgeMs, now - admission.createdAt)
    }

    return {
      oldestPendingAgeMs,
      pendingAdmissions: pendingAdmissions.size,
    }
  }

  function pendingAdmissionMetricFields() {
    const metrics = getPendingAdmissionMetrics()
    return {
      oldestPendingAgeMs: String(metrics.oldestPendingAgeMs),
      pendingAdmissions: String(metrics.pendingAdmissions),
    }
  }

  function recordPendingAdmissionMetrics(reason: string) {
    logger.info("pending_admission_metrics", {
      reason,
      ...pendingAdmissionMetricFields(),
    })
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
      releaseAllPendingAdmissions()
      await closeGateway(io, httpServer)
    },
    disconnectUser,
    getPendingAdmissionMetrics,
    httpServer,
    io,
    start: (port) => startGateway(httpServer, port),
  }
}

type ChatAdmission = {
  clientIp: string | undefined
  reservationToken: string
  userId: string
}

type PendingAdmission = ChatAdmission & {
  createdAt: number
  timeout: NodeJS.Timeout | undefined
}

function addPendingAdmissionToken(
  reservations: Map<string, Set<string>>,
  key: string,
  reservationToken: string
) {
  const tokens = reservations.get(key) ?? new Set<string>()
  tokens.add(reservationToken)
  reservations.set(key, tokens)
}

function removePendingAdmissionToken(
  reservations: Map<string, Set<string>>,
  key: string,
  reservationToken: string
) {
  const tokens = reservations.get(key)
  tokens?.delete(reservationToken)

  if (tokens?.size === 0) {
    reservations.delete(key)
  }
}

function getGatewayClientIp(socket: Socket) {
  const header = socket.handshake.headers["cf-connecting-ip"]
  const value = (Array.isArray(header) ? header[0] : header)?.trim().toLowerCase()

  return value && isIP(value) !== 0 ? value : undefined
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

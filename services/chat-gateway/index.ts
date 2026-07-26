import { pathToFileURL } from "node:url"

import { createAdapter } from "@socket.io/redis-adapter"
import Redis from "ioredis"

import { assertProductionAppOrigin } from "../../src/lib/app-origin"
import {
  authenticateChatGatewayConnection,
  revalidateChatGatewayAuthorization,
  type ChatGatewayUserStore,
} from "../../src/lib/chat/gateway-auth"
import { isChatEnabled } from "../../src/lib/chat/feature-flags"
import {
  CHAT_ROOM_EVENT_CHANNEL,
  parseChatRoomEvent,
} from "../../src/lib/chat/room-events"
import {
  CHAT_ACCOUNT_SECURITY_EVENT_CHANNEL,
  parseAccountSecurityEvent,
} from "../../src/lib/chat/security-events"
import {
  CHAT_BLOCK_EVENT_CHANNEL,
  parseChatBlockEvent,
} from "../../src/lib/chat/block-events"
import { listChatBlockedUserIds } from "../../src/lib/chat/blocks"
import { getChatConnectionTokenSettings } from "../../src/lib/chat/session-token"
import {
  clearChatPresence,
  createChatPresenceTelemetry,
  markChatPresence,
  refreshChatPresence,
} from "../../src/lib/chat/presence"
import { getPrisma } from "../../src/lib/db"
import { ephemeralRedisConnectionOptions } from "../../src/lib/redis-config"
import { enforceRateLimit } from "../../src/lib/rate-limit"

import { createChatGateway, type ChatGateway } from "./gateway"
import { createChatGatewayLogger } from "./logger"
import {
  DEFAULT_CHAT_GATEWAY_ABUSE_SETTINGS,
  type ChatGatewayAbuseSettings,
} from "./abuse"
import {
  attachNativeChatGateway,
  nativeChatRoomEventName,
  nativeChatUserEventName,
} from "./native-chat"
import {
  getChatRoomSnapshot,
  sendChatRoomMessage,
  updateChatReadMarker,
} from "../../src/lib/chat/room-service"
import { createRedisRecoverySupervisor, type GatewayRedisClient } from "./redis-recovery"

const DEFAULT_CHAT_GATEWAY_PORT = 3001
const DEFAULT_AUTHORIZATION_MAX_AGE_SECONDS = 60
const DEFAULT_REDIS_DEGRADED_GRACE_SECONDS = 90

type ChatGatewayStartupStage = "attach-native-chat" | "connect-redis" | "create-gateway"

class ChatGatewayStartupError extends Error {
  readonly errorClass: string

  constructor(
    readonly stage: ChatGatewayStartupStage,
    error: unknown
  ) {
    super("Chat gateway startup failed.")
    this.name = "ChatGatewayStartupError"
    this.errorClass = error instanceof Error ? error.name : "UnknownError"
  }
}

export async function createProductionChatGateway(
  environment: Readonly<Record<string, string | undefined>> = process.env,
  { exit = (code: number) => process.exit(code) }: { exit?: (code: number) => never | void } = {}
): Promise<{ close: () => Promise<void>; gateway: ChatGateway; port: number }> {
  const logger = createChatGatewayLogger()
  const presenceTelemetry = createChatPresenceTelemetry((event, metrics) => {
    const fields = Object.fromEntries(
      Object.entries(metrics).map(([key, value]) => [key, String(value)])
    )

    if (event === "refresh-failure") {
      logger.warn("presence_refresh_failed", fields)
      return
    }

    logger.info("presence_metrics", fields)
  })

  if (!isChatEnabled(environment)) {
    throw new Error("Arctic IRC is disabled.")
  }

  const origin = assertProductionAppOrigin(environment).origin
  const tokenSettings = getChatConnectionTokenSettings(environment)
  const recoverySettings = getChatGatewayRecoverySettings(environment)
  const abuseSettings = getChatGatewayAbuseSettings(environment)
  const port = getChatGatewayPort(environment)
  const prisma = getPrisma()
  const redis = createGatewayRedisClient()
  const redisPublisher = redis.duplicate()
  const redisSubscriber = redis.duplicate()
  const blockEventSubscriber = redis.duplicate()
  const roomEventSubscriber = redis.duplicate()
  const securityEventSubscriber = redis.duplicate()
  let gateway: ChatGateway | undefined
  let terminating = false
  let startupStage: ChatGatewayStartupStage = "connect-redis"

  const recovery = createRedisRecoverySupervisor({
    clients: {
      adapterPublisher: asGatewayRedisClient(redisPublisher),
      adapterSubscriber: asGatewayRedisClient(redisSubscriber),
      blockEvents: asGatewayRedisClient(blockEventSubscriber),
      command: asGatewayRedisClient(redis),
      roomEvents: asGatewayRedisClient(roomEventSubscriber),
      securityEvents: asGatewayRedisClient(securityEventSubscriber),
    },
    gracePeriodMs: recoverySettings.redisDegradedGraceSeconds * 1_000,
    onDegradedTimeout: () => {
      if (terminating) {
        return
      }

      terminating = true
      logger.warn("redis_recovery_exhausted")
      void Promise.all([gateway?.close() ?? Promise.resolve(), recovery.close()]).finally(() => {
        exit(1)
      })
    },
    onStateChange: (state) => {
      if (state.ready) {
        logger.info("redis_ready", {
          reconnectCount: String(state.reconnectCount),
          subscriberChannelCount: "3",
        })
      } else {
        logger.warn("redis_degraded", { reconnectCount: String(state.reconnectCount) })
      }
    },
    resubscribe: async () => {
      await Promise.all([
        blockEventSubscriber.subscribe(CHAT_BLOCK_EVENT_CHANNEL),
        roomEventSubscriber.subscribe(CHAT_ROOM_EVENT_CHANNEL),
        securityEventSubscriber.subscribe(CHAT_ACCOUNT_SECURITY_EVENT_CHANNEL),
      ])
    },
  })

  roomEventSubscriber.on("message", (channel, payload) => {
    if (channel === CHAT_ROOM_EVENT_CHANNEL && gateway) {
      void fanOutChatRoomEvent(gateway, parseChatRoomEvent(payload))
    }
  })
  blockEventSubscriber.on("message", (channel, payload) => {
    if (channel === CHAT_BLOCK_EVENT_CHANNEL && gateway) {
      void fanOutChatBlockEvent(gateway, parseChatBlockEvent(payload))
    }
  })
  securityEventSubscriber.on("message", (channel, payload) => {
    if (channel !== CHAT_ACCOUNT_SECURITY_EVENT_CHANNEL || !gateway) {
      return
    }

    const event = parseAccountSecurityEvent(payload)
    if (event) {
      gateway.disconnectUser(event.userId, event.reason)
    }
  })

  try {
    // The Socket.IO Redis adapter subscribes as soon as it is attached. Its
    // clients deliberately reject queued commands, so establish all Redis
    // connections before constructing the adapter.
    await recovery.start()

    startupStage = "create-gateway"
    gateway = createChatGateway({
      authenticateConnection: (input) =>
        authenticateChatGatewayConnection({
          environment,
          expectedOrigin: origin,
          origin: input.origin,
          replayStore: redis,
          store: prisma as ChatGatewayUserStore,
          token: input.token,
          tokenSecret: tokenSettings.secret,
        }),
      authorizationMaxAgeMs: recoverySettings.authorizationMaxAgeSeconds * 1_000,
      abuseSettings,
      configureIo: (io) => io.adapter(createAdapter(redisPublisher, redisSubscriber)),
      isConnectionReady: recovery.isReady,
      logger,
      limitChatAction: async ({ action, ip, roomId, userId }) =>
        (await enforceRateLimit({ action, ip, roomId, userId })).allowed,
      readiness: async () => {
        if (!recovery.isReady()) {
          throw new Error("Redis is unavailable.")
        }
        await Promise.all([redis.ping(), prisma.$queryRawUnsafe("SELECT 1")])
      },
      revalidateAuthorization: (identity) =>
        revalidateChatGatewayAuthorization({
          environment,
          identity,
          store: prisma as ChatGatewayUserStore,
        }),
    })

    startupStage = "attach-native-chat"
    attachNativeChatGateway(
      gateway.io,
      {
        getBlockedUserIds: (input) => listChatBlockedUserIds({ ...input, store: prisma }),
        getSnapshot: (input) => getChatRoomSnapshot({ ...input, store: prisma }),
        sendMessage: (input) => sendChatRoomMessage({ ...input, store: prisma }),
        updateReadMarker: (input) => updateChatReadMarker({ ...input, store: prisma }),
      },
      async (identity, roomId) =>
        (
          await enforceRateLimit({
            action: "chat_message",
            roomId,
            userId: identity.userId,
          })
        ).allowed,
      {
        clear: (input) => clearChatPresence(input, redis),
        mark: (input) => markChatPresence(input, redis),
        refresh: (entries) => refreshChatPresence(entries, redis),
        telemetry: presenceTelemetry,
      }
    )

    const activeGateway = gateway
    if (!activeGateway) {
      throw new Error("Chat gateway did not initialize.")
    }

    return {
      close: async () => {
        terminating = true
        await Promise.all([activeGateway.close(), recovery.close()])
      },
      gateway: activeGateway,
      port,
    }
  } catch (error) {
    terminating = true
    await Promise.allSettled([gateway?.close() ?? Promise.resolve(), recovery.close()])
    throw new ChatGatewayStartupError(startupStage, error)
  }
}

export function getChatGatewayPort(
  environment: Readonly<Record<string, string | undefined>> = process.env
) {
  const rawPort = environment.CHAT_GATEWAY_PORT?.trim()

  if (!rawPort) {
    return DEFAULT_CHAT_GATEWAY_PORT
  }

  const port = Number(rawPort)

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("CHAT_GATEWAY_PORT must be a valid TCP port.")
  }

  return port
}

export function getChatGatewayRecoverySettings(
  environment: Readonly<Record<string, string | undefined>> = process.env
) {
  return {
    authorizationMaxAgeSeconds: parseBoundedPositiveInteger(
      environment.ARCTIC_IRC_AUTHORIZATION_MAX_AGE_SECONDS,
      DEFAULT_AUTHORIZATION_MAX_AGE_SECONDS,
      15,
      300,
      "ARCTIC_IRC_AUTHORIZATION_MAX_AGE_SECONDS"
    ),
    redisDegradedGraceSeconds: parseBoundedPositiveInteger(
      environment.ARCTIC_IRC_REDIS_DEGRADED_GRACE_SECONDS,
      DEFAULT_REDIS_DEGRADED_GRACE_SECONDS,
      15,
      600,
      "ARCTIC_IRC_REDIS_DEGRADED_GRACE_SECONDS"
    ),
  }
}

export function getChatGatewayAbuseSettings(
  environment: Readonly<Record<string, string | undefined>> = process.env
): ChatGatewayAbuseSettings {
  return {
    maxActiveSocketsPerIp: parseBoundedPositiveInteger(
      environment.ARCTIC_IRC_MAX_SOCKETS_PER_IP,
      DEFAULT_CHAT_GATEWAY_ABUSE_SETTINGS.maxActiveSocketsPerIp,
      1,
      100,
      "ARCTIC_IRC_MAX_SOCKETS_PER_IP"
    ),
    maxActiveSocketsPerUser: parseBoundedPositiveInteger(
      environment.ARCTIC_IRC_MAX_SOCKETS_PER_USER,
      DEFAULT_CHAT_GATEWAY_ABUSE_SETTINGS.maxActiveSocketsPerUser,
      1,
      20,
      "ARCTIC_IRC_MAX_SOCKETS_PER_USER"
    ),
    maxEventPayloadBytes: parseBoundedPositiveInteger(
      environment.ARCTIC_IRC_MAX_EVENT_PAYLOAD_BYTES,
      DEFAULT_CHAT_GATEWAY_ABUSE_SETTINGS.maxEventPayloadBytes,
      1_024,
      1_048_576,
      "ARCTIC_IRC_MAX_EVENT_PAYLOAD_BYTES"
    ),
    maxMalformedEvents: parseBoundedPositiveInteger(
      environment.ARCTIC_IRC_MAX_MALFORMED_EVENTS,
      DEFAULT_CHAT_GATEWAY_ABUSE_SETTINGS.maxMalformedEvents,
      1,
      20,
      "ARCTIC_IRC_MAX_MALFORMED_EVENTS"
    ),
    maxOutstandingOperations: parseBoundedPositiveInteger(
      environment.ARCTIC_IRC_MAX_OUTSTANDING_OPERATIONS,
      DEFAULT_CHAT_GATEWAY_ABUSE_SETTINGS.maxOutstandingOperations,
      1,
      50,
      "ARCTIC_IRC_MAX_OUTSTANDING_OPERATIONS"
    ),
    maxRoomsPerSocket: parseBoundedPositiveInteger(
      environment.ARCTIC_IRC_MAX_ROOMS_PER_SOCKET,
      DEFAULT_CHAT_GATEWAY_ABUSE_SETTINGS.maxRoomsPerSocket,
      1,
      100,
      "ARCTIC_IRC_MAX_ROOMS_PER_SOCKET"
    ),
  }
}

function createGatewayRedisClient() {
  const redis = new Redis(ephemeralRedisConnectionOptions().url, {
    connectTimeout: 1_000,
    enableOfflineQueue: false,
    lazyConnect: true,
    maxRetriesPerRequest: 0,
    retryStrategy: (attempt) => {
      const exponentialDelay = Math.min(1_000 * 2 ** Math.min(attempt - 1, 5), 30_000)
      const jitter = Math.floor(Math.random() * Math.min(1_000, exponentialDelay / 4))
      return exponentialDelay + jitter
    },
  })

  redis.on("error", () => {
    // The supervisor logs only connection state, never Redis URLs or payloads.
  })

  return redis
}

function asGatewayRedisClient(client: Redis) {
  return client as unknown as GatewayRedisClient
}

function parseBoundedPositiveInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  variableName: string
) {
  if (!value?.trim()) {
    return fallback
  }

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${variableName} must be an integer between ${minimum} and ${maximum}.`)
  }

  return parsed
}

async function fanOutChatRoomEvent(gateway: ChatGateway, event: ReturnType<typeof parseChatRoomEvent>) {
  if (!event) {
    return
  }

  if (event.type === "room-message") {
    const sockets = await gateway.io
      .in(nativeChatRoomEventName(event.message.roomId))
      .fetchSockets()
    await Promise.all(
      sockets
        .filter((socket) => !isBlockedChatMessage(socket.data.chatBlockedUserIds, event.message.senderUserId))
        .map((socket) => socket.emit("room:message", event.message))
    )
    return
  }

  const roomName = nativeChatRoomEventName(event.roomId)
  const sockets = await gateway.io.in(roomName).fetchSockets()
  if (event.type === "room-closed") {
    await Promise.all(sockets.map((socket) => socket.leave(roomName)))
    return
  }

  await Promise.all(
    sockets
      .filter((socket) => socket.data.chat?.userId === event.targetUserId)
      .map((socket) => socket.leave(roomName))
  )
}

async function fanOutChatBlockEvent(
  gateway: ChatGateway,
  event: ReturnType<typeof parseChatBlockEvent>
) {
  if (!event) {
    return
  }

  const sockets = await gateway.io.in(nativeChatUserEventName(event.blockerUserId)).fetchSockets()
  await Promise.all(
    sockets.map(async (socket) => {
      const current = Array.isArray(socket.data.chatBlockedUserIds)
        ? socket.data.chatBlockedUserIds.filter((value: unknown): value is string => typeof value === "string")
        : []
      const blockedUserIds = new Set(current)
      if (event.action === "blocked") {
        blockedUserIds.add(event.blockedUserId)
      } else {
        blockedUserIds.delete(event.blockedUserId)
      }

      socket.data.chatBlockedUserIds = [...blockedUserIds]
      socket.emit("chat:block-update", {
        action: event.action,
        blockedUserId: event.blockedUserId,
      })
    })
  )
}

function isBlockedChatMessage(blockedUserIds: unknown, senderUserId: string | null) {
  if (!senderUserId) {
    return false
  }

  return !Array.isArray(blockedUserIds) || blockedUserIds.includes(senderUserId)
}

async function start() {
  const logger = createChatGatewayLogger()

  try {
    const service = await createProductionChatGateway()
    await service.gateway.start(service.port)
    logger.info("startup", { port: String(service.port) })

    const shutdown = async () => {
      logger.info("shutdown")
      await service.close()
      process.exit(0)
    }

    process.once("SIGINT", () => void shutdown())
    process.once("SIGTERM", () => void shutdown())
  } catch (error) {
    const failure = error instanceof ChatGatewayStartupError ? error : undefined

    logger.warn("startup_failed", {
      errorClass: failure?.errorClass ?? (error instanceof Error ? error.name : "UnknownError"),
      stage: failure?.stage ?? "configuration",
    })
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void start()
}

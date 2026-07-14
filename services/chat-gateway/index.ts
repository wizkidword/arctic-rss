import { pathToFileURL } from "node:url"

import { createAdapter } from "@socket.io/redis-adapter"
import Redis from "ioredis"

import { assertProductionAppOrigin } from "../../src/lib/app-origin"
import {
  authenticateChatGatewayConnection,
  type ChatGatewayUserStore,
} from "../../src/lib/chat/gateway-auth"
import { isChatEnabled } from "../../src/lib/chat/feature-flags"
import {
  CHAT_ROOM_EVENT_CHANNEL,
  parseChatRoomEvent,
} from "../../src/lib/chat/room-events"
import { getChatConnectionTokenSettings } from "../../src/lib/chat/session-token"
import {
  clearChatPresence,
  markChatPresence,
} from "../../src/lib/chat/presence"
import { getPrisma } from "../../src/lib/db"
import { redisConnectionOptions } from "../../src/lib/feed-refresh-queue"
import { enforceRateLimit } from "../../src/lib/rate-limit"

import { createChatGateway, type ChatGateway } from "./gateway"
import { createChatGatewayLogger } from "./logger"
import { attachNativeChatGateway, nativeChatRoomEventName } from "./native-chat"
import {
  getChatRoomSnapshot,
  sendChatRoomMessage,
  updateChatReadMarker,
} from "../../src/lib/chat/room-service"

const DEFAULT_CHAT_GATEWAY_PORT = 3001

export async function createProductionChatGateway(
  environment: Readonly<Record<string, string | undefined>> = process.env
): Promise<{ close: () => Promise<void>; gateway: ChatGateway; port: number }> {
  const logger = createChatGatewayLogger()

  if (!isChatEnabled(environment)) {
    throw new Error("Arctic IRC is disabled.")
  }

  const origin = assertProductionAppOrigin(environment).origin
  const tokenSettings = getChatConnectionTokenSettings(environment)
  const port = getChatGatewayPort(environment)
  const prisma = getPrisma()
  const redis = createGatewayRedisClient()
  const redisSubscriber = redis.duplicate()
  const roomEventSubscriber = redis.duplicate()
  redisSubscriber.on("error", () => {
    // The service's readiness and authentication paths already fail closed.
  })
  roomEventSubscriber.on("error", () => {
    // The service's readiness and authentication paths already fail closed.
  })

  try {
    await Promise.all([
      redis.connect(),
      redisSubscriber.connect(),
      roomEventSubscriber.connect(),
    ])

    await Promise.all([
      redis.ping(),
      redisSubscriber.ping(),
      roomEventSubscriber.ping(),
    ])

    const gateway = createChatGateway({
      authenticateConnection: (input) =>
        authenticateChatGatewayConnection({
          expectedOrigin: origin,
          origin: input.origin,
          replayStore: redis,
          store: prisma as ChatGatewayUserStore,
          token: input.token,
          tokenSecret: tokenSettings.secret,
        }),
      configureIo: (io) => io.adapter(createAdapter(redis, redisSubscriber)),
      logger,
      readiness: async () => {
        await Promise.all([redis.ping(), prisma.$queryRawUnsafe("SELECT 1")])
      },
    })

    attachNativeChatGateway(
      gateway.io,
      {
        getSnapshot: (input) => getChatRoomSnapshot({ ...input, store: prisma }),
        sendMessage: (input) => sendChatRoomMessage({ ...input, store: prisma }),
        updateReadMarker: (input) => updateChatReadMarker({ ...input, store: prisma }),
      },
      async (identity) =>
        (await enforceRateLimit({ action: "chat_message", userId: identity.userId }))
          .allowed,
      {
        clear: (input) => clearChatPresence(input, redis),
        mark: (input) => markChatPresence(input, redis),
      }
    )

    roomEventSubscriber.on("message", (channel, payload) => {
      if (channel !== CHAT_ROOM_EVENT_CHANNEL) {
        return
      }

      void fanOutChatRoomEvent(gateway, parseChatRoomEvent(payload))
    })
    await roomEventSubscriber.subscribe(CHAT_ROOM_EVENT_CHANNEL)

    return {
      close: async () => {
        await gateway.close()
        await Promise.all([
          redis.quit(),
          redisSubscriber.quit(),
          roomEventSubscriber.quit(),
        ])
      },
      gateway,
      port,
    }
  } catch (error) {
    redis.disconnect()
    redisSubscriber.disconnect()
    roomEventSubscriber.disconnect()
    throw error
  }
}

async function fanOutChatRoomEvent(gateway: ChatGateway, event: ReturnType<typeof parseChatRoomEvent>) {
  if (!event) {
    return
  }

  if (event.type === "room-message") {
    gateway.io
      .to(nativeChatRoomEventName(event.message.roomId))
      .emit("room:message", event.message)
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

function createGatewayRedisClient() {
  const redis = new Redis(redisConnectionOptions().url, {
    connectTimeout: 1_000,
    enableOfflineQueue: false,
    lazyConnect: true,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null,
  })

  redis.on("error", () => {
    // Liveness/readiness and connection authentication fail closed; never log
    // Redis URLs, token data, or raw request details.
  })

  return redis
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
  } catch {
    logger.warn("startup_failed")
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void start()
}

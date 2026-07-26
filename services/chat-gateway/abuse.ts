import type { Socket } from "socket.io"

import type { ChatGatewayIdentity } from "../../src/lib/chat/gateway-auth"
import type { ChatGatewayLogger } from "./logger"

export const CHAT_GATEWAY_RATE_LIMIT_ACTIONS = [
  "chat_connection",
  "chat_authorization_failure",
  "chat_room_subscribe",
  "chat_room_unsubscribe",
  "chat_read_marker",
  "chat_message",
  "chat_malformed_event",
] as const

export type ChatGatewayRateLimitAction =
  (typeof CHAT_GATEWAY_RATE_LIMIT_ACTIONS)[number]

export type ChatGatewayEventLimiter = (input: {
  action: ChatGatewayRateLimitAction
  ip?: string
  roomId?: string
  userId?: string
}) => Promise<boolean>

export type ChatGatewayAbuseSettings = {
  maxActiveSocketsPerIp: number
  maxActiveSocketsPerUser: number
  maxEventPayloadBytes: number
  maxMalformedEvents: number
  maxOutstandingOperations: number
  maxRoomsPerSocket: number
}

export const DEFAULT_CHAT_GATEWAY_ABUSE_SETTINGS: ChatGatewayAbuseSettings = {
  maxActiveSocketsPerIp: 20,
  maxActiveSocketsPerUser: 5,
  maxEventPayloadBytes: 64 * 1024,
  maxMalformedEvents: 5,
  maxOutstandingOperations: 8,
  maxRoomsPerSocket: 20,
}

export type ChatSocketAbuseControls = {
  finishOperation: () => void
  isActionAllowed: (action: ChatGatewayRateLimitAction, roomId?: string) => Promise<boolean>
  isRoomLimitReached: (roomId: string, subscribedRoomIds: ReadonlySet<string>) => boolean
  recordMalformedEvent: () => void
  tryStartOperation: () => boolean
}

export function createChatSocketAbuseControls({
  clientIp,
  identity,
  limiter,
  logger,
  settings,
  socket,
}: {
  clientIp: string | undefined
  identity: ChatGatewayIdentity
  limiter: ChatGatewayEventLimiter
  logger: ChatGatewayLogger
  settings: ChatGatewayAbuseSettings
  socket: Socket
}): ChatSocketAbuseControls {
  let malformedEventCount = 0
  let outstandingOperations = 0

  return {
    finishOperation() {
      outstandingOperations = Math.max(0, outstandingOperations - 1)
    },
    async isActionAllowed(action, roomId) {
      return limiter({
        action,
        ip: clientIp,
        roomId,
        userId: identity.userId,
      })
    },
    isRoomLimitReached(roomId, subscribedRoomIds) {
      return (
        !subscribedRoomIds.has(roomId) &&
        subscribedRoomIds.size >= settings.maxRoomsPerSocket
      )
    },
    recordMalformedEvent() {
      malformedEventCount += 1
      void limiter({
        action: "chat_malformed_event",
        ip: clientIp,
        userId: identity.userId,
      })

      logger.warn("malformed_event", {
        malformedEventCount: String(malformedEventCount),
      })

      if (malformedEventCount >= settings.maxMalformedEvents) {
        logger.warn("malformed_event_disconnect", {
          malformedEventCount: String(malformedEventCount),
        })
        socket.disconnect(true)
      }
    },
    tryStartOperation() {
      if (outstandingOperations >= settings.maxOutstandingOperations) {
        logger.warn("operation_limit_rejected", {
          maxOutstandingOperations: String(settings.maxOutstandingOperations),
        })
        return false
      }

      outstandingOperations += 1
      return true
    },
  }
}

export function getChatSocketAbuseControls(socket: Socket) {
  return socket.data.chatAbuse as ChatSocketAbuseControls
}

export function safeAck(callback: unknown, payload: Record<string, unknown>) {
  if (typeof callback !== "function") {
    return
  }

  try {
    callback(payload)
  } catch {
    // A peer acknowledgement callback must never take down the gateway.
  }
}

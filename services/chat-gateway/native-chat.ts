import type { Server, Socket } from "socket.io"

import type { ChatGatewayIdentity } from "../../src/lib/chat/gateway-auth"
import { listChatBlockedUserIds } from "../../src/lib/chat/blocks"
import {
  createChatPresenceHeartbeat,
  type ChatPresenceEntry,
  type ChatPresenceTelemetry,
} from "../../src/lib/chat/presence"
import {
  getChatSocketAbuseControls,
  safeAck,
  type ChatSocketAbuseControls,
} from "./abuse"
import {
  getChatRoomSnapshot,
  parseChatMessageInput,
  sendChatRoomMessage,
  updateChatReadMarker,
} from "../../src/lib/chat/room-service"

const ROOM_EVENT_PREFIX = "native-room:"

export type NativeChatGatewayService = {
  getBlockedUserIds: typeof listChatBlockedUserIds
  getSnapshot: typeof getChatRoomSnapshot
  sendMessage: typeof sendChatRoomMessage
  updateReadMarker: typeof updateChatReadMarker
}

export type NativeChatRateLimiter = (
  identity: ChatGatewayIdentity,
  roomId: string
) => Promise<boolean>

export type NativeChatPresence = {
  clear: (input: ChatPresenceEntry) => Promise<void>
  mark: (input: ChatPresenceEntry) => Promise<void>
  refresh: (entries: readonly ChatPresenceEntry[]) => Promise<void>
  telemetry?: ChatPresenceTelemetry
}

export function attachNativeChatGateway(
  io: Server,
  service: NativeChatGatewayService,
  isMessageAllowed: NativeChatRateLimiter,
  presence?: NativeChatPresence
) {
  io.on("connection", (socket) => {
    void attachSocketHandlers(socket, io, service, isMessageAllowed, presence)
  })
}

async function attachSocketHandlers(
  socket: Socket,
  io: Server,
  service: NativeChatGatewayService,
  isMessageAllowed: NativeChatRateLimiter,
  presence?: NativeChatPresence
) {
  const identity = socket.data.chat as ChatGatewayIdentity
  const abuse = getChatSocketAbuseControls(socket)
  const subscribedRoomIds = new Set<string>()
  let blockedUserIdsPromise: Promise<string[]> | undefined
  const ensureBlockedUserIds = async () => {
    blockedUserIdsPromise ??= service.getBlockedUserIds({ userId: identity.userId })
    const blockedUserIds = await blockedUserIdsPromise
    socket.data.chatBlockedUserIds = blockedUserIds
    return blockedUserIds
  }
  void Promise.resolve(socket.join(nativeChatUserEventName(identity.userId))).catch(() => socket.disconnect(true))
  const presenceHeartbeat = presence
    ? createChatPresenceHeartbeat({
        connectionId: socket.id,
        getRoomIds: () => subscribedRoomIds,
        onRefreshFailure: () => presence.telemetry?.recordRefreshFailure(),
        refresh: (entries) => presence.refresh(entries),
        userId: identity.userId,
      })
    : undefined

  socket.onAny((eventName) => {
    if (!NATIVE_CHAT_EVENTS.has(eventName)) {
      abuse.recordMalformedEvent()
    }
  })

  socket.on("room:subscribe", (payload: unknown, acknowledge: Ack) => {
    void handleSubscribe(
      socket,
      identity,
      service,
      presence,
      presenceHeartbeat,
      ensureBlockedUserIds,
      subscribedRoomIds,
      payload,
      acknowledge,
      abuse
    )
  })
  socket.on("room:unsubscribe", (payload: unknown, acknowledge: Ack) => {
    const roomId = parseRoomId(payload)

    if (!roomId) {
      rejectMalformedEvent(abuse, acknowledge)
      return
    }

    void runSocketOperation({
      abuse,
      acknowledge,
      action: "chat_room_unsubscribe",
      roomId,
      run: async () => {
        await socket.leave(nativeChatRoomEventName(roomId))
        const wasSubscribed = subscribedRoomIds.delete(roomId)
        if (wasSubscribed) {
          presence?.telemetry?.recordSubscriptionRemoved()
          presence?.telemetry?.recordCleanup(1)
          if (subscribedRoomIds.size === 0) {
            presenceHeartbeat?.stop()
          }
        }
        await presence?.clear({
          connectionId: socket.id,
          roomId,
          userId: identity.userId,
        })
        safeAck(acknowledge, { ok: true })
      },
    })
  })
  socket.on("room:message", (payload: unknown, acknowledge: Ack) => {
    void handleMessage(
      socket,
      identity,
      service,
      isMessageAllowed,
      payload,
      acknowledge,
      abuse
    )
  })
  socket.on("room:read", (payload: unknown, acknowledge: Ack) => {
    void handleReadMarker(identity, service, payload, acknowledge, abuse)
  })
  socket.on("disconnect", () => {
    presenceHeartbeat?.stop()
    const roomIds = [...subscribedRoomIds]
    subscribedRoomIds.clear()
    if (roomIds.length > 0) {
      presence?.telemetry?.recordSubscriptionRemoved(roomIds.length)
      presence?.telemetry?.recordCleanup(roomIds.length)
    }
    void Promise.all(
      roomIds.map((roomId) =>
        presence?.clear({
          connectionId: socket.id,
          roomId,
          userId: identity.userId,
        })
      )
    ).catch(() => {})
  })
}

async function handleSubscribe(
  socket: Socket,
  identity: ChatGatewayIdentity,
  service: NativeChatGatewayService,
  presence: NativeChatPresence | undefined,
  presenceHeartbeat: ReturnType<typeof createChatPresenceHeartbeat> | undefined,
  ensureBlockedUserIds: () => Promise<string[]>,
  subscribedRoomIds: Set<string>,
  payload: unknown,
  acknowledge: Ack,
  abuse: ChatSocketAbuseControls
) {
  const slug = parseSlug(payload)

  if (!slug) {
    rejectMalformedEvent(abuse, acknowledge)
    return
  }

  void runSocketOperation({
    abuse,
    acknowledge,
    action: "chat_room_subscribe",
    roomId: slug,
    run: async () => {
      if (abuse.isRoomLimitReached(slug, subscribedRoomIds)) {
        safeAck(acknowledge, { ok: false, error: "room-limit" })
        return
      }

      await ensureBlockedUserIds()
      const snapshot = await service.getSnapshot({ identity, slug })
      if (abuse.isRoomLimitReached(snapshot.room.id, subscribedRoomIds)) {
        safeAck(acknowledge, { ok: false, error: "room-limit" })
        return
      }

      await presence?.mark({
        connectionId: socket.id,
        roomId: snapshot.room.id,
        userId: identity.userId,
      })
      await socket.join(nativeChatRoomEventName(snapshot.room.id))
      const wasSubscribed = subscribedRoomIds.has(snapshot.room.id)
      subscribedRoomIds.add(snapshot.room.id)
      if (!wasSubscribed) {
        presence?.telemetry?.recordSubscriptionAdded()
        presenceHeartbeat?.start()
      }
      safeAck(acknowledge, { ok: true, snapshot })
    },
  })
}

async function handleMessage(
  socket: Socket,
  identity: ChatGatewayIdentity,
  service: NativeChatGatewayService,
  isMessageAllowed: NativeChatRateLimiter,
  payload: unknown,
  acknowledge: Ack,
  abuse: ChatSocketAbuseControls
) {
  const roomId = parseRoomId(payload)

  if (!roomId || !isSocketInRoom(socket, roomId)) {
    rejectMalformedEvent(abuse, acknowledge)
    return
  }

  let message: ReturnType<typeof parseChatMessagePayload>
  try {
    message = parseChatMessagePayload(payload)
  } catch {
    rejectMalformedEvent(abuse, acknowledge)
    return
  }

  void runSocketOperation({
    abuse,
    acknowledge,
    action: "chat_message",
    roomId,
    useExternalLimiter: false,
    run: async () => {
      if (!(await isMessageAllowed(identity, roomId))) {
        safeAck(acknowledge, { ok: false, error: "rate-limited" })
        return
      }

      const result = await service.sendMessage({
        ...message,
        identity,
        roomId,
      })

      safeAck(acknowledge, { ok: true, created: result.created, message: result.message })
    },
  })
}

async function runSocketOperation({
  abuse,
  acknowledge,
  action,
  roomId,
  run,
  useExternalLimiter = true,
}: {
  abuse: ChatSocketAbuseControls
  acknowledge: Ack
  action: Parameters<ChatSocketAbuseControls["isActionAllowed"]>[0]
  roomId?: string
  run: () => Promise<void>
  useExternalLimiter?: boolean
}) {
  if (!abuse.tryStartOperation()) {
    safeAck(acknowledge, { ok: false, error: "too-many-operations" })
    return
  }

  try {
    if (useExternalLimiter && !(await abuse.isActionAllowed(action, roomId))) {
      safeAck(acknowledge, { ok: false, error: "rate-limited" })
      return
    }

    await run()
  } catch {
    safeAck(acknowledge, { ok: false, error: "request-rejected" })
  } finally {
    abuse.finishOperation()
  }
}

function rejectMalformedEvent(abuse: ChatSocketAbuseControls, acknowledge: Ack) {
  abuse.recordMalformedEvent()
  safeAck(acknowledge, { ok: false, error: "request-rejected" })
}

async function handleReadMarker(
  identity: ChatGatewayIdentity,
  service: NativeChatGatewayService,
  payload: unknown,
  acknowledge: Ack,
  abuse: ChatSocketAbuseControls
) {
  const roomId = parseRoomId(payload)
  const messageId = parseMessageId(payload)

  if (!roomId || !messageId) {
    rejectMalformedEvent(abuse, acknowledge)
    return
  }

  void runSocketOperation({
    abuse,
    acknowledge,
    action: "chat_read_marker",
    roomId,
    run: async () => {
      await service.updateReadMarker({ identity, messageId, roomId })
      safeAck(acknowledge, { ok: true })
    },
  })
}

function parseSlug(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  const slug = (value as { slug?: unknown }).slug
  return typeof slug === "string" && slug.length <= 64 ? slug : null
}

function parseRoomId(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  const roomId = (value as { roomId?: unknown }).roomId
  return typeof roomId === "string" && roomId.length > 0 && roomId.length <= 128
    ? roomId
    : null
}

function parseChatMessagePayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return parseChatMessageInput(value)
  }

  const payload = value as {
    body?: unknown
    clientMessageId?: unknown
    kind?: unknown
  }

  return parseChatMessageInput({
    body: payload.body,
    clientMessageId: payload.clientMessageId,
    kind: payload.kind,
  })
}

function parseMessageId(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  const messageId = (value as { messageId?: unknown }).messageId

  if (
    typeof messageId !== "string" ||
    messageId.length < 8 ||
    messageId.length > 128 ||
    !/^[A-Za-z0-9_-]+$/.test(messageId)
  ) {
    return null
  }

  return messageId
}

function isSocketInRoom(socket: Socket, roomId: string) {
  return socket.rooms.has(nativeChatRoomEventName(roomId))
}

export function nativeChatRoomEventName(roomId: string) {
  return `${ROOM_EVENT_PREFIX}${roomId}`
}

export function nativeChatUserEventName(userId: string) {
  return `${ROOM_EVENT_PREFIX}user:${userId}`
}

const NATIVE_CHAT_EVENTS = new Set([
  "room:subscribe",
  "room:unsubscribe",
  "room:message",
  "room:read",
])

type Ack = unknown

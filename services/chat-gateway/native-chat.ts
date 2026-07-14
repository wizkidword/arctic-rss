import type { Server, Socket } from "socket.io"

import type { ChatGatewayIdentity } from "../../src/lib/chat/gateway-auth"
import {
  getChatRoomSnapshot,
  parseChatMessageInput,
  sendChatRoomMessage,
  updateChatReadMarker,
} from "../../src/lib/chat/room-service"

const ROOM_EVENT_PREFIX = "native-room:"

export type NativeChatGatewayService = {
  getSnapshot: typeof getChatRoomSnapshot
  sendMessage: typeof sendChatRoomMessage
  updateReadMarker: typeof updateChatReadMarker
}

export type NativeChatRateLimiter = (identity: ChatGatewayIdentity) => Promise<boolean>

export type NativeChatPresence = {
  clear: (input: {
    connectionId: string
    roomId: string
    userId: string
  }) => Promise<void>
  mark: (input: {
    connectionId: string
    roomId: string
    userId: string
  }) => Promise<void>
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
  const subscribedRoomIds = new Set<string>()

  socket.on("room:subscribe", (payload: unknown, acknowledge: Ack) => {
    void handleSubscribe(
      socket,
      identity,
      service,
      presence,
      subscribedRoomIds,
      payload,
      acknowledge
    )
  })
  socket.on("room:unsubscribe", (payload: unknown, acknowledge: Ack) => {
    const roomId = parseRoomId(payload)

    if (!roomId) {
      acknowledge({ ok: false, error: "request-rejected" })
      return
    }

    void Promise.resolve(socket.leave(nativeChatRoomEventName(roomId)))
      .then(async () => {
        subscribedRoomIds.delete(roomId)
        await presence?.clear({
          connectionId: socket.id,
          roomId,
          userId: identity.userId,
        })
        acknowledge({ ok: true })
      })
      .catch(() => acknowledge({ ok: false, error: "request-rejected" }))
  })
  socket.on("room:message", (payload: unknown, acknowledge: Ack) => {
    void handleMessage(socket, io, identity, service, isMessageAllowed, payload, acknowledge)
  })
  socket.on("room:read", (payload: unknown, acknowledge: Ack) => {
    void handleReadMarker(identity, service, payload, acknowledge)
  })
  socket.on("disconnect", () => {
    void Promise.all(
      [...subscribedRoomIds].map((roomId) =>
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
  subscribedRoomIds: Set<string>,
  payload: unknown,
  acknowledge: Ack
) {
  const slug = parseSlug(payload)

  if (!slug) {
    acknowledge({ ok: false, error: "request-rejected" })
    return
  }

  try {
    const snapshot = await service.getSnapshot({ identity, slug })
    await presence?.mark({
      connectionId: socket.id,
      roomId: snapshot.room.id,
      userId: identity.userId,
    })
    await socket.join(nativeChatRoomEventName(snapshot.room.id))
    subscribedRoomIds.add(snapshot.room.id)
    acknowledge({ ok: true, snapshot })
  } catch {
    acknowledge({ ok: false, error: "request-rejected" })
  }
}

async function handleMessage(
  socket: Socket,
  io: Server,
  identity: ChatGatewayIdentity,
  service: NativeChatGatewayService,
  isMessageAllowed: NativeChatRateLimiter,
  payload: unknown,
  acknowledge: Ack
) {
  const roomId = parseRoomId(payload)

  if (!roomId || !isSocketInRoom(socket, roomId)) {
    acknowledge({ ok: false, error: "request-rejected" })
    return
  }

  try {
    const message = parseChatMessagePayload(payload)

    if (!(await isMessageAllowed(identity))) {
      acknowledge({ ok: false, error: "rate-limited" })
      return
    }

    const result = await service.sendMessage({
      ...message,
      identity,
      roomId,
    })

    if (result.created) {
      io.to(nativeChatRoomEventName(roomId)).emit("room:message", result.message)
    }

    acknowledge({ ok: true, created: result.created, message: result.message })
  } catch {
    acknowledge({ ok: false, error: "request-rejected" })
  }
}

async function handleReadMarker(
  identity: ChatGatewayIdentity,
  service: NativeChatGatewayService,
  payload: unknown,
  acknowledge: Ack
) {
  const roomId = parseRoomId(payload)
  const sequence = parseSequence(payload)

  if (!roomId || sequence === undefined) {
    acknowledge({ ok: false, error: "request-rejected" })
    return
  }

  try {
    await service.updateReadMarker({ identity, roomId, sequence })
    acknowledge({ ok: true })
  } catch {
    acknowledge({ ok: false, error: "request-rejected" })
  }
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

function parseSequence(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined
  }

  const sequence = (value as { sequence?: unknown }).sequence

  if (typeof sequence !== "string" || !/^\d+$/.test(sequence)) {
    return undefined
  }

  return BigInt(sequence)
}

function isSocketInRoom(socket: Socket, roomId: string) {
  return socket.rooms.has(nativeChatRoomEventName(roomId))
}

export function nativeChatRoomEventName(roomId: string) {
  return `${ROOM_EVENT_PREFIX}${roomId}`
}

type Ack = (result: Record<string, unknown>) => void

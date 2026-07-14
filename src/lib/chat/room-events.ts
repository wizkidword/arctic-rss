import Redis from "ioredis"

import { redisConnectionOptions } from "@/lib/feed-refresh-queue"

import type { ChatMessageWire } from "./room-service"

export const CHAT_ROOM_EVENT_CHANNEL = "arctic-rss:chat:room-events:v1"

export type ChatRoomMessageEvent = {
  message: ChatMessageWire
  type: "room-message"
}

export type ChatRoomMembershipRemovedEvent = {
  roomId: string
  targetUserId: string
  type: "membership-removed"
}

export type ChatRoomClosedEvent = {
  roomId: string
  type: "room-closed"
}

export type ChatRoomEvent =
  | ChatRoomClosedEvent
  | ChatRoomMembershipRemovedEvent
  | ChatRoomMessageEvent

export type ChatRoomEventPublisher = {
  publish(channel: string, message: string): Promise<number>
}

let publisher: Redis | undefined

export async function publishChatRoomMessage(
  message: ChatMessageWire,
  dependencies: { publisher?: ChatRoomEventPublisher } = {}
) {
  const event: ChatRoomMessageEvent = { message, type: "room-message" }
  await (dependencies.publisher ?? getChatRoomEventPublisher()).publish(
    CHAT_ROOM_EVENT_CHANNEL,
    JSON.stringify(event)
  )
}

export async function publishChatRoomMembershipRemoved(
  event: Omit<ChatRoomMembershipRemovedEvent, "type">,
  dependencies: { publisher?: ChatRoomEventPublisher } = {}
) {
  await (dependencies.publisher ?? getChatRoomEventPublisher()).publish(
    CHAT_ROOM_EVENT_CHANNEL,
    JSON.stringify({ ...event, type: "membership-removed" })
  )
}

export async function publishChatRoomClosed(
  event: Omit<ChatRoomClosedEvent, "type">,
  dependencies: { publisher?: ChatRoomEventPublisher } = {}
) {
  await (dependencies.publisher ?? getChatRoomEventPublisher()).publish(
    CHAT_ROOM_EVENT_CHANNEL,
    JSON.stringify({ ...event, type: "room-closed" })
  )
}

export function parseChatRoomEvent(value: string): ChatRoomEvent | null {
  try {
    const event = JSON.parse(value) as unknown

    if (!event || typeof event !== "object" || Array.isArray(event)) {
      return null
    }

    const candidate = event as {
      message?: unknown
      roomId?: unknown
      targetUserId?: unknown
      type?: unknown
    }
    if (candidate.type === "room-message" && isChatMessageWire(candidate.message)) {
      return { message: candidate.message, type: "room-message" }
    }
    if (
      candidate.type === "membership-removed" &&
      isRoomEventIdentifier(candidate.roomId) &&
      isRoomEventIdentifier(candidate.targetUserId)
    ) {
      return {
        roomId: candidate.roomId,
        targetUserId: candidate.targetUserId,
        type: "membership-removed",
      }
    }
    if (candidate.type === "room-closed" && isRoomEventIdentifier(candidate.roomId)) {
      return { roomId: candidate.roomId, type: "room-closed" }
    }

    return null
  } catch {
    return null
  }
}

export function parseChatRoomMessageEvent(value: string): ChatRoomMessageEvent | null {
  const event = parseChatRoomEvent(value)
  return event?.type === "room-message" ? event : null
}

function isRoomEventIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{8,128}$/.test(value)
}

function getChatRoomEventPublisher() {
  if (!publisher || publisher.status === "end") {
    publisher = new Redis(redisConnectionOptions().url, {
      connectTimeout: 1_000,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
    })
    publisher.on("error", () => {
      // Delivery failure is handled by the route. Do not log event contents.
    })
  }

  return publisher
}

function isChatMessageWire(value: unknown): value is ChatMessageWire {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false
  }

  const message = value as Record<string, unknown>
  const isString = (field: string) => typeof message[field] === "string"
  const article = message.article
  const validArticle = Boolean(
    article === null ||
    (article &&
      typeof article === "object" &&
      !Array.isArray(article) &&
      typeof (article as Record<string, unknown>).id === "string" &&
      typeof (article as Record<string, unknown>).publisher === "string" &&
      typeof (article as Record<string, unknown>).title === "string")
  )

  return (
    validArticle &&
    isString("body") &&
    isString("clientMessageId") &&
    isString("createdAt") &&
    isString("id") &&
    isString("roomId") &&
    isString("sequence") &&
    (message.kind === "TEXT" ||
      message.kind === "ACTION" ||
      message.kind === "NOTICE" ||
      message.kind === "SYSTEM" ||
      message.kind === "ARTICLE" ||
      message.kind === "BOT") &&
    (message.senderHandle === null || typeof message.senderHandle === "string") &&
    (message.senderUserId === null || typeof message.senderUserId === "string")
  )
}

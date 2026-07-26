import Redis from "ioredis"

import { redisConnectionOptions } from "@/lib/feed-refresh-queue"

export const CHAT_BLOCK_EVENT_CHANNEL = "arctic-rss:chat:block-events:v1"

export type ChatBlockEvent = {
  action: "blocked" | "unblocked"
  blockedUserId: string
  blockerUserId: string
}

export type ChatBlockEventPublisher = {
  publish(channel: string, message: string): Promise<number>
}

let publisher: Redis | undefined

export async function publishChatBlockEvent(
  event: ChatBlockEvent,
  dependencies: { publisher?: ChatBlockEventPublisher } = {}
) {
  await (dependencies.publisher ?? getChatBlockEventPublisher()).publish(
    CHAT_BLOCK_EVENT_CHANNEL,
    JSON.stringify(event)
  )
}

export function parseChatBlockEvent(value: string): ChatBlockEvent | null {
  try {
    const event = JSON.parse(value) as unknown
    if (!event || typeof event !== "object" || Array.isArray(event)) {
      return null
    }

    const candidate = event as Partial<ChatBlockEvent>
    if (
      (candidate.action !== "blocked" && candidate.action !== "unblocked") ||
      !isChatIdentifier(candidate.blockedUserId) ||
      !isChatIdentifier(candidate.blockerUserId)
    ) {
      return null
    }

    return {
      action: candidate.action,
      blockedUserId: candidate.blockedUserId,
      blockerUserId: candidate.blockerUserId,
    }
  } catch {
    return null
  }
}

function isChatIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{8,128}$/.test(value)
}

function getChatBlockEventPublisher() {
  if (!publisher || publisher.status === "end") {
    publisher = new Redis(redisConnectionOptions().url, {
      connectTimeout: 1_000,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
    })
    publisher.on("error", () => {})
  }

  return publisher
}

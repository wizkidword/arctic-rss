import type { Prisma } from "@/generated/prisma/client"

import { getPrisma } from "@/lib/db"

import {
  parseChatRoomEvent,
  publishChatRoomEvent,
  type ChatRoomEvent,
  type ChatRoomEventPublisher,
} from "./room-events"

export const CHAT_EVENT_OUTBOX_VERSION = 1
export const CHAT_EVENT_OUTBOX_BATCH_SIZE = 100
export const CHAT_EVENT_OUTBOX_LEASE_MS = 30_000
export const CHAT_EVENT_OUTBOX_MAX_ATTEMPTS = 12

type ChatEventOutboxRecord = {
  attemptCount: number
  id: string
  payload: unknown
}

export type ChatEventOutboxWriter = {
  chatEventOutbox: {
    create(args: Record<string, unknown>): Promise<unknown>
  }
}

export type ChatEventOutboxStore = {
  chatEventOutbox: {
    findMany(args: Record<string, unknown>): Promise<ChatEventOutboxRecord[]>
    updateMany(args: Record<string, unknown>): Promise<{ count: number }>
  }
}

export async function enqueueChatRoomEvent({
  event,
  store,
}: {
  event: ChatRoomEvent
  store: ChatEventOutboxWriter
}) {
  const canonicalEvent = parseChatRoomEvent(JSON.stringify(event))

  if (!canonicalEvent) {
    throw new Error("A chat outbox event must use the compact room-event schema.")
  }

  return store.chatEventOutbox.create({
    data: {
      aggregateId:
        canonicalEvent.type === "room-message"
          ? canonicalEvent.message.roomId
          : canonicalEvent.roomId,
      aggregateType: "CHAT_ROOM",
      eventType: canonicalEvent.type,
      payload: canonicalEvent as Prisma.InputJsonValue,
      version: CHAT_EVENT_OUTBOX_VERSION,
    },
  })
}

export async function processChatEventOutbox({
  batchSize = CHAT_EVENT_OUTBOX_BATCH_SIZE,
  maxAttempts = CHAT_EVENT_OUTBOX_MAX_ATTEMPTS,
  now = () => new Date(),
  owner = `chat-outbox:${process.pid}`,
  publisher,
  store = getPrisma() as unknown as ChatEventOutboxStore,
}: {
  batchSize?: number
  maxAttempts?: number
  now?: () => Date
  owner?: string
  publisher?: ChatRoomEventPublisher
  store?: ChatEventOutboxStore
}) {
  const startedAt = now()
  const leaseExpiresAt = new Date(startedAt.getTime() + CHAT_EVENT_OUTBOX_LEASE_MS)
  const candidates = await store.chatEventOutbox.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: Math.max(1, Math.min(CHAT_EVENT_OUTBOX_BATCH_SIZE, Math.floor(batchSize))),
    where: {
      availableAt: { lte: startedAt },
      deadLetteredAt: null,
      deliveredAt: null,
      OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: startedAt } }],
    },
  })
  const result = { claimed: 0, deadLettered: 0, delivered: 0, failed: 0 }

  for (const candidate of candidates) {
    const claimed = await store.chatEventOutbox.updateMany({
      data: {
        attemptCount: { increment: 1 },
        leaseExpiresAt,
        leaseOwner: owner,
      },
      where: {
        availableAt: { lte: startedAt },
        deadLetteredAt: null,
        deliveredAt: null,
        id: candidate.id,
        OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: startedAt } }],
      },
    })
    if (!claimed.count) {
      continue
    }

    result.claimed += 1
    const attemptCount = candidate.attemptCount + 1

    try {
      const event = parseChatRoomEvent(JSON.stringify(candidate.payload))
      if (!event) {
        throw new Error("Stored payload does not match the chat room-event schema.")
      }

      await publishChatRoomEvent(event, publisher ? { publisher } : {})
      const delivered = await store.chatEventOutbox.updateMany({
        data: {
          deliveredAt: now(),
          lastError: null,
          leaseExpiresAt: null,
          leaseOwner: null,
        },
        where: { deliveredAt: null, id: candidate.id, leaseOwner: owner },
      })
      if (delivered.count) {
        result.delivered += 1
      }
    } catch (error) {
      const lastError = outboxErrorMessage(error)
      const terminal = attemptCount >= Math.max(1, maxAttempts)
      await store.chatEventOutbox.updateMany({
        data: terminal
          ? {
              deadLetteredAt: now(),
              lastError,
              leaseExpiresAt: null,
              leaseOwner: null,
            }
          : {
              availableAt: new Date(now().getTime() + retryDelayMs(attemptCount)),
              lastError,
              leaseExpiresAt: null,
              leaseOwner: null,
            },
        where: { deliveredAt: null, id: candidate.id, leaseOwner: owner },
      })
      if (terminal) {
        result.deadLettered += 1
        console.error(
          JSON.stringify({
            attemptCount,
            event: "chat_event_outbox_dead_lettered",
            eventId: candidate.id,
            outcome: "alert",
          })
        )
      } else {
        result.failed += 1
      }
    }
  }

  return result
}

function retryDelayMs(attemptCount: number) {
  return Math.min(300_000, 1_000 * 2 ** Math.min(Math.max(0, attemptCount - 1), 8))
}

function outboxErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown chat outbox publishing error."
  return message.replace(/[\r\n\u0000-\u001f\u007f]/g, " ").slice(0, 500)
}

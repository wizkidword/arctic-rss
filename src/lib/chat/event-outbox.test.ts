import { describe, expect, it, vi } from "vitest"

import {
  enqueueChatRoomEvent,
  processChatEventOutbox,
  type ChatEventOutboxStore,
} from "./event-outbox"

const now = new Date("2026-07-26T16:00:00.000Z")
const event = {
  message: {
    article: null,
    body: "Durable hello",
    clientMessageId: "message-0001",
    createdAt: "2026-07-26T16:00:00.000Z",
    id: "message-1234",
    kind: "TEXT" as const,
    roomId: "room-1234",
    senderHandle: "northernlights",
    senderUserId: "user-1234",
    sequence: "1",
  },
  type: "room-message" as const,
}

function createStore({ attemptCount = 0, payload = event }: { attemptCount?: number; payload?: unknown } = {}) {
  const findMany = vi.fn().mockResolvedValue([{ attemptCount, id: "event-1234", payload }])
  const updateMany = vi.fn()
  return {
    chatEventOutbox: { findMany, updateMany },
  } as unknown as ChatEventOutboxStore
}

describe("chat event outbox", () => {
  it("persists only the compact room event in the same chat-state transaction", async () => {
    const create = vi.fn().mockResolvedValue({ id: "event-1234" })

    await enqueueChatRoomEvent({
      event,
      store: { chatEventOutbox: { create } },
    })

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        aggregateId: "room-1234",
        aggregateType: "CHAT_ROOM",
        eventType: "room-message",
        payload: event,
        version: 1,
      }),
    })
  })

  it("keeps a committed event retryable when Redis publishing fails", async () => {
    const store = createStore()
    const publish = vi.fn().mockRejectedValue(new Error("Redis unavailable"))
    vi.mocked(store.chatEventOutbox.updateMany)
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 })

    await expect(
      processChatEventOutbox({
        now: () => now,
        owner: "worker-a",
        publisher: { publish },
        store,
      })
    ).resolves.toEqual({ claimed: 1, deadLettered: 0, delivered: 0, failed: 1 })

    expect(store.chatEventOutbox.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          availableAt: new Date(now.getTime() + 1_000),
          lastError: "Redis unavailable",
          leaseOwner: null,
        }),
      })
    )
  })

  it("does not let a second publisher steal an active lease", async () => {
    const store = createStore()
    const publish = vi.fn().mockResolvedValue(1)
    vi.mocked(store.chatEventOutbox.updateMany).mockResolvedValue({ count: 0 })

    await expect(
      processChatEventOutbox({
        now: () => now,
        owner: "worker-b",
        publisher: { publish },
        store,
      })
    ).resolves.toEqual({ claimed: 0, deadLettered: 0, delivered: 0, failed: 0 })
    expect(publish).not.toHaveBeenCalled()
  })

  it("replays safely after publishing succeeds but delivery acknowledgement is lost", async () => {
    const store = createStore()
    const publish = vi.fn().mockResolvedValue(1)
    vi.mocked(store.chatEventOutbox.updateMany)
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 })

    await processChatEventOutbox({
      now: () => now,
      owner: "worker-a",
      publisher: { publish },
      store,
    })
    await expect(
      processChatEventOutbox({
        now: () => now,
        owner: "worker-b",
        publisher: { publish },
        store,
      })
    ).resolves.toEqual({ claimed: 1, deadLettered: 0, delivered: 1, failed: 0 })

    expect(publish).toHaveBeenCalledTimes(2)
    expect(publish).toHaveBeenLastCalledWith(
      "arctic-rss:chat:room-events:v1",
      JSON.stringify(event)
    )
  })

  it("dead-letters malformed or repeatedly failing events without publishing their payload", async () => {
    const store = createStore({ payload: { evidence: "do-not-publish", type: "report-created" } })
    const publish = vi.fn().mockResolvedValue(1)
    vi.mocked(store.chatEventOutbox.updateMany)
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 })

    await expect(
      processChatEventOutbox({
        maxAttempts: 1,
        now: () => now,
        owner: "worker-a",
        publisher: { publish },
        store,
      })
    ).resolves.toEqual({ claimed: 1, deadLettered: 1, delivered: 0, failed: 0 })
    expect(publish).not.toHaveBeenCalled()
    expect(store.chatEventOutbox.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deadLetteredAt: now,
          leaseOwner: null,
        }),
      })
    )
  })
})

import { describe, expect, it, vi } from "vitest"

import {
  enqueueDueFeedRefreshes,
  schedulerSettings,
} from "./refresh-scheduler"

function createStore({ claimCount = 1 } = {}) {
  return {
    feed: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "feed-due-first",
          nextFetchAt: new Date("2026-07-13T11:00:00.000Z"),
        },
        {
          id: "feed-due-second",
          nextFetchAt: new Date("2026-07-13T11:30:00.000Z"),
        },
      ]),
      updateMany: vi.fn().mockResolvedValue({ count: claimCount }),
    },
  }
}

describe("refresh scheduler", () => {
  it("selects only due feeds in deterministic due-time order", async () => {
    const store = createStore()
    const enqueue = vi.fn().mockResolvedValue({})
    const now = new Date("2026-07-13T12:00:00.000Z")

    const result = await enqueueDueFeedRefreshes({
      batchSize: 100,
      enqueue,
      now,
      store,
    })

    expect(store.feed.findMany).toHaveBeenCalledWith({
      orderBy: [{ nextFetchAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        nextFetchAt: true,
      },
      take: 100,
      where: {
        nextFetchAt: {
          lte: now,
        },
        subscriptions: {
          some: {
            isPaused: false,
          },
        },
      },
    })
    expect(enqueue).toHaveBeenNthCalledWith(1, "feed-due-first")
    expect(enqueue).toHaveBeenNthCalledWith(2, "feed-due-second")
    expect(result).toEqual({
      dueCount: 2,
      duplicatePrevented: 0,
      enqueuedCount: 2,
    })
  })

  it("does not enqueue a feed that another scheduler already claimed", async () => {
    const store = createStore({ claimCount: 0 })
    const enqueue = vi.fn()

    const result = await enqueueDueFeedRefreshes({
      batchSize: 100,
      enqueue,
      now: new Date("2026-07-13T12:00:00.000Z"),
      store,
    })

    expect(enqueue).not.toHaveBeenCalled()
    expect(result).toEqual({
      dueCount: 2,
      duplicatePrevented: 2,
      enqueuedCount: 0,
    })
  })

  it("allows only one of two concurrent schedulers to claim the same feed", async () => {
    let claimed = false
    const store = {
      feed: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "feed-due",
            nextFetchAt: new Date("2026-07-13T11:00:00.000Z"),
          },
        ]),
        updateMany: vi.fn().mockImplementation(async () => {
          if (claimed) {
            return { count: 0 }
          }

          claimed = true
          return { count: 1 }
        }),
      },
    }
    const enqueue = vi.fn().mockResolvedValue({})
    const options = {
      batchSize: 100,
      enqueue,
      now: new Date("2026-07-13T12:00:00.000Z"),
      store,
    }

    const [first, second] = await Promise.all([
      enqueueDueFeedRefreshes(options),
      enqueueDueFeedRefreshes(options),
    ])

    expect(enqueue).toHaveBeenCalledTimes(1)
    expect(first.enqueuedCount + second.enqueuedCount).toBe(1)
    expect(first.duplicatePrevented + second.duplicatePrevented).toBe(1)
  })

  it("clamps scheduler environment values before they reach the worker", () => {
    expect(
      schedulerSettings({
        AI_DIGEST_CONCURRENCY: "999",
        FEED_REFRESH_CONCURRENCY: "0",
        FEED_SCHEDULER_BATCH_SIZE: "50000",
        FEED_SCHEDULER_INTERVAL_MS: "10",
        SMART_DIGEST_CONCURRENCY: "0",
        SMART_DIGEST_EMAIL_CONCURRENCY: "999",
      })
    ).toMatchObject({
      aiDigestConcurrency: 8,
      feedRefreshConcurrency: 1,
      schedulerBatchSize: 1_000,
      schedulerIntervalMs: 10_000,
      smartDigestConcurrency: 1,
      smartDigestEmailConcurrency: 8,
    })
  })
})

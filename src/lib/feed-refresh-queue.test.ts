import { beforeEach, describe, expect, it, vi } from "vitest"

const queueAdd = vi.fn()
const queueGetJob = vi.fn()
const queueConstructor = vi.fn(function Queue() {
  return {
    add: queueAdd,
    getJob: queueGetJob,
  }
})

vi.mock("bullmq", () => ({
  Queue: queueConstructor,
}))

describe("feed refresh queue", () => {
  beforeEach(() => {
    vi.resetModules()
    queueAdd.mockReset()
    queueGetJob.mockReset()
    queueConstructor.mockClear()
    let storedOptions: Record<string, unknown> | undefined
    queueAdd.mockImplementation(async (_name, _data, options) => {
      storedOptions ??= options
      return { id: options.jobId }
    })
    queueGetJob.mockImplementation(async () =>
      storedOptions ? { opts: storedOptions } : undefined
    )
  })

  it("uses BullMQ-compatible job ids", async () => {
    const { feedRefreshJobId } = await import("./feed-refresh-queue")

    expect(feedRefreshJobId("feed_123:abc")).toBe("feed-feed_123-abc")
  })

  it("atomically creates a source refresh with fixed durability settings", async () => {
    const { enqueueFeedRefresh, feedRefreshJobId } = await import(
      "./feed-refresh-queue"
    )

    await expect(enqueueFeedRefresh("feed-1")).resolves.toEqual({
      jobId: feedRefreshJobId("feed-1"),
      outcome: "queued",
    })

    expect(queueAdd).toHaveBeenCalledWith(
      "refresh-feed",
      { feedId: "feed-1", trigger: "scheduler" },
      expect.objectContaining({
        attempts: 3,
        backoff: {
          delay: 10_000,
          type: "exponential",
        },
        jobId: feedRefreshJobId("feed-1"),
        removeOnComplete: true,
        removeOnFail: true,
      })
    )
  })

  it("reports the loser of concurrent deterministic adds as already active", async () => {
    const { enqueueFeedRefresh, feedRefreshJobId } = await import("./feed-refresh-queue")

    const [first, second] = await Promise.all([
      enqueueFeedRefresh("feed-1", { trigger: "manual" }),
      enqueueFeedRefresh("feed-1", { trigger: "manual" }),
    ])

    expect([first, second]).toContainEqual({
      jobId: feedRefreshJobId("feed-1"),
      outcome: "queued",
    })
    expect([first, second]).toContainEqual({
      jobId: feedRefreshJobId("feed-1"),
      outcome: "already-active",
    })
    expect(queueAdd).toHaveBeenCalledTimes(2)
  })

  it("stores only the feed identifier and the safe trigger label", async () => {
    const { enqueueFeedRefresh } = await import("./feed-refresh-queue")

    await enqueueFeedRefresh("feed-1", { priority: 1, trigger: "manual" })

    expect(queueAdd).toHaveBeenCalledWith(
      "refresh-feed",
      { feedId: "feed-1", trigger: "manual" },
      expect.objectContaining({ priority: 1 })
    )
  })

  it("returns unavailable when BullMQ cannot confirm the stored job", async () => {
    const { enqueueFeedRefresh, feedRefreshJobId } = await import("./feed-refresh-queue")
    queueGetJob.mockResolvedValue(undefined)

    await expect(enqueueFeedRefresh("feed-1")).resolves.toEqual({
      jobId: feedRefreshJobId("feed-1"),
      outcome: "unavailable",
    })
  })
})

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
  })

  it("uses BullMQ-compatible job ids", async () => {
    const { feedRefreshJobId } = await import("./feed-refresh-queue")

    expect(feedRefreshJobId("feed_123:abc")).toBe("feed-feed_123-abc")
  })

  it("removes terminal source failures so the same source can be queued again", async () => {
    const { enqueueFeedRefresh, feedRefreshJobId } = await import(
      "./feed-refresh-queue"
    )

    await expect(enqueueFeedRefresh("feed-1")).resolves.toEqual({
      jobId: feedRefreshJobId("feed-1"),
      outcome: "queued",
    })

    expect(queueGetJob).toHaveBeenCalledWith(feedRefreshJobId("feed-1"))
    expect(queueAdd).toHaveBeenCalledWith(
      "refresh-feed",
      { feedId: "feed-1", trigger: "scheduler" },
      {
        attempts: 3,
        backoff: {
          delay: 10_000,
          type: "exponential",
        },
        jobId: feedRefreshJobId("feed-1"),
        removeOnComplete: true,
        removeOnFail: true,
      }
    )
  })

  it("reports an already queued source without adding a duplicate job", async () => {
    const { enqueueFeedRefresh, feedRefreshJobId } = await import("./feed-refresh-queue")
    queueGetJob.mockResolvedValueOnce({ id: feedRefreshJobId("feed-1") })

    await expect(enqueueFeedRefresh("feed-1", { trigger: "manual" })).resolves.toEqual({
      jobId: feedRefreshJobId("feed-1"),
      outcome: "already-queued",
    })
    expect(queueAdd).not.toHaveBeenCalled()
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
})

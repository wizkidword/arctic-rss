import { beforeEach, describe, expect, it, vi } from "vitest"

const queueAdd = vi.fn()
const queueConstructor = vi.fn(function Queue() {
  return {
    add: queueAdd,
  }
})

vi.mock("bullmq", () => ({
  Queue: queueConstructor,
}))

describe("feed refresh queue", () => {
  beforeEach(() => {
    vi.resetModules()
    queueAdd.mockReset()
    queueConstructor.mockClear()
  })

  it("uses BullMQ-compatible job ids", async () => {
    const { feedRefreshJobId } = await import("./feed-refresh-queue")

    expect(feedRefreshJobId("feed_123:abc")).toBe("feed-feed_123-abc")
  })

  it("removes failed queue jobs so scheduled retries are not blocked", async () => {
    const { enqueueFeedRefresh, feedRefreshJobId } = await import(
      "./feed-refresh-queue"
    )

    await enqueueFeedRefresh("feed-1")

    expect(queueAdd).toHaveBeenCalledWith(
      "refresh-feed",
      { feedId: "feed-1" },
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
})

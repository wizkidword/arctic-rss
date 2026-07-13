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

describe("podcast refresh queue", () => {
  beforeEach(() => {
    vi.resetModules()
    queueAdd.mockReset()
    queueConstructor.mockClear()
  })

  it("uses a stable queue name", async () => {
    const { PODCAST_REFRESH_QUEUE_NAME } = await import(
      "./podcast-refresh-queue"
    )

    expect(PODCAST_REFRESH_QUEUE_NAME).toBe("podcast-refresh")
  })

  it("does not create the queue at import time", async () => {
    await import("./podcast-refresh-queue")

    expect(queueConstructor).not.toHaveBeenCalled()
  })

  it("uses BullMQ-compatible job ids", async () => {
    const { podcastRefreshJobId } = await import("./podcast-refresh-queue")

    expect(podcastRefreshJobId("podcast_123:abc")).toBe(
      "podcast-podcast_123-abc"
    )
  })

  it("enqueues podcast refreshes with stable defaults", async () => {
    const { enqueuePodcastRefresh, podcastRefreshJobId } = await import(
      "./podcast-refresh-queue"
    )

    await enqueuePodcastRefresh("podcast-1")

    expect(queueAdd).toHaveBeenCalledWith(
      "refresh-podcast",
      { podcastId: "podcast-1" },
      {
        attempts: 3,
        backoff: {
          delay: 30_000,
          type: "exponential",
        },
        jobId: podcastRefreshJobId("podcast-1"),
        removeOnComplete: true,
        removeOnFail: {
          age: 24 * 60 * 60,
          count: 1000,
        },
      }
    )
  })

  it("applies options overrides after defaults", async () => {
    const { enqueuePodcastRefresh } = await import("./podcast-refresh-queue")

    await enqueuePodcastRefresh("podcast-1", {
      attempts: 1,
      jobId: "manual-job",
    })

    expect(queueAdd).toHaveBeenCalledWith(
      "refresh-podcast",
      { podcastId: "podcast-1" },
      {
        attempts: 1,
        backoff: {
          delay: 30_000,
          type: "exponential",
        },
        jobId: "manual-job",
        removeOnComplete: true,
        removeOnFail: {
          age: 24 * 60 * 60,
          count: 1000,
        },
      }
    )
  })
})

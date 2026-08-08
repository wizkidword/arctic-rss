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

describe("podcast refresh queue", () => {
  beforeEach(() => {
    vi.resetModules()
    queueAdd.mockReset()
    queueGetJob.mockReset()
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

    await expect(enqueuePodcastRefresh("podcast-1")).resolves.toEqual({
      jobId: podcastRefreshJobId("podcast-1"),
      outcome: "queued",
    })

    expect(queueAdd).toHaveBeenCalledWith(
      "refresh-podcast",
      { podcastId: "podcast-1", trigger: "scheduler" },
      {
        attempts: 3,
        backoff: {
          delay: 30_000,
          type: "exponential",
        },
        jobId: podcastRefreshJobId("podcast-1"),
        removeOnComplete: true,
        removeOnFail: true,
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
      { podcastId: "podcast-1", trigger: "scheduler" },
      {
        attempts: 1,
        backoff: {
          delay: 30_000,
          type: "exponential",
        },
        jobId: "manual-job",
        removeOnComplete: true,
        removeOnFail: true,
      }
    )
  })

  it("reports an already queued source without adding a duplicate job", async () => {
    const { enqueuePodcastRefresh, podcastRefreshJobId } = await import("./podcast-refresh-queue")
    queueGetJob.mockResolvedValueOnce({ id: podcastRefreshJobId("podcast-1") })

    await expect(enqueuePodcastRefresh("podcast-1", { trigger: "manual" })).resolves.toEqual({
      jobId: podcastRefreshJobId("podcast-1"),
      outcome: "already-queued",
    })
    expect(queueAdd).not.toHaveBeenCalled()
  })
})

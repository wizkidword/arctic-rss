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
    let storedOptions: Record<string, unknown> | undefined
    queueAdd.mockImplementation(async (_name, _data, options) => {
      storedOptions ??= options
      return { id: options.jobId }
    })
    queueGetJob.mockImplementation(async () =>
      storedOptions ? { opts: storedOptions } : undefined
    )
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
      expect.objectContaining({
        attempts: 3,
        backoff: {
          delay: 30_000,
          type: "exponential",
        },
        jobId: podcastRefreshJobId("podcast-1"),
        removeOnComplete: true,
        removeOnFail: true,
      })
    )
  })

  it("only allows the safe priority override", async () => {
    const { enqueuePodcastRefresh } = await import("./podcast-refresh-queue")

    await enqueuePodcastRefresh("podcast-1", {
      priority: 1,
    })

    expect(queueAdd).toHaveBeenCalledWith(
      "refresh-podcast",
      { podcastId: "podcast-1", trigger: "scheduler" },
      expect.objectContaining({
        attempts: 3,
        jobId: "podcast-podcast-1",
        priority: 1,
      })
    )
  })

  it("reports the loser of concurrent deterministic adds as already active", async () => {
    const { enqueuePodcastRefresh, podcastRefreshJobId } = await import("./podcast-refresh-queue")

    const [first, second] = await Promise.all([
      enqueuePodcastRefresh("podcast-1", { trigger: "manual" }),
      enqueuePodcastRefresh("podcast-1", { trigger: "manual" }),
    ])

    expect([first, second]).toContainEqual({
      jobId: podcastRefreshJobId("podcast-1"),
      outcome: "queued",
    })
    expect([first, second]).toContainEqual({
      jobId: podcastRefreshJobId("podcast-1"),
      outcome: "already-active",
    })
    expect(queueAdd).toHaveBeenCalledTimes(2)
  })

  it("returns unavailable when BullMQ cannot confirm the stored job", async () => {
    const { enqueuePodcastRefresh, podcastRefreshJobId } = await import(
      "./podcast-refresh-queue"
    )
    queueGetJob.mockResolvedValue(undefined)

    await expect(enqueuePodcastRefresh("podcast-1")).resolves.toEqual({
      jobId: podcastRefreshJobId("podcast-1"),
      outcome: "unavailable",
    })
  })
})

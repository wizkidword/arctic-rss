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

describe("bulk read queue", () => {
  beforeEach(() => {
    vi.resetModules()
    queueAdd.mockReset()
    queueConstructor.mockClear()
  })

  it("uses a stable job id and retains failures for diagnosis", async () => {
    const { bulkReadQueueJobId, enqueueBulkReadJob } = await import(
      "./bulk-read-queue"
    )

    await enqueueBulkReadJob("job:one")

    expect(bulkReadQueueJobId("job:one")).toBe("bulk-read-job-one")
    expect(queueAdd).toHaveBeenCalledWith(
      "mark-articles-read",
      { jobId: "job:one" },
      {
        attempts: 3,
        backoff: {
          delay: 10_000,
          type: "exponential",
        },
        jobId: "bulk-read-job-one",
        removeOnComplete: true,
        removeOnFail: {
          age: 24 * 60 * 60,
          count: 1000,
        },
      }
    )
  })
})

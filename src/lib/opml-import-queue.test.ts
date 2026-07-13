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

describe("OPML import queue", () => {
  beforeEach(() => {
    vi.resetModules()
    queueAdd.mockReset()
    queueConstructor.mockClear()
  })

  it("gives every bounded continuation its own retained queue id", async () => {
    const { enqueueOpmlImportJob, opmlImportQueueJobId } = await import(
      "./opml-import-queue"
    )

    await enqueueOpmlImportJob("job:one", 7)

    expect(opmlImportQueueJobId("job:one", 7)).toBe("opml-import-job-one-7")
    expect(queueAdd).toHaveBeenCalledWith(
      "import-opml",
      { jobId: "job:one", run: 7 },
      {
        attempts: 3,
        backoff: {
          delay: 10_000,
          type: "exponential",
        },
        jobId: "opml-import-job-one-7",
        removeOnComplete: true,
        removeOnFail: {
          age: 24 * 60 * 60,
          count: 1_000,
        },
      }
    )
  })
})

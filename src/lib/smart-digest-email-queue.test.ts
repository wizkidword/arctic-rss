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

describe("smart digest email queue", () => {
  beforeEach(() => {
    vi.resetModules()
    queueAdd.mockReset()
    queueConstructor.mockClear()
  })

  it("uses an independent stable queue for bounded delivery retries", async () => {
    const {
      enqueueSmartDigestEmail,
      SMART_DIGEST_EMAIL_QUEUE_NAME,
      smartDigestEmailJobId,
    } = await import("./smart-digest-email-queue")

    await enqueueSmartDigestEmail("run/1")

    expect(SMART_DIGEST_EMAIL_QUEUE_NAME).toBe("smart-digest-email")
    expect(queueAdd).toHaveBeenCalledWith(
      "deliver-smart-digest-email",
      { runId: "run/1" },
      {
        attempts: 3,
        backoff: {
          delay: 30_000,
          type: "exponential",
        },
        jobId: smartDigestEmailJobId("run/1"),
        removeOnComplete: true,
        removeOnFail: {
          age: 7 * 24 * 60 * 60,
          count: 1000,
        },
      }
    )
  })
})

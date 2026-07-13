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

const scheduledFor = "2026-07-13T08:00:00.000Z"

describe("smart digest queue", () => {
  beforeEach(() => {
    vi.resetModules()
    queueAdd.mockReset()
    queueConstructor.mockClear()
  })

  it("uses a stable queue name", async () => {
    const { SMART_DIGEST_QUEUE_NAME } = await import("./smart-digest-queue")

    expect(SMART_DIGEST_QUEUE_NAME).toBe("smart-digest")
  })

  it("does not create the queue at import time", async () => {
    await import("./smart-digest-queue")

    expect(queueConstructor).not.toHaveBeenCalled()
  })

  it("uses one job ID per rule and scheduled run", async () => {
    const { smartDigestJobId } = await import("./smart-digest-queue")

    expect(smartDigestJobId("rule/1", scheduledFor)).toBe(
      "smart-digest-rule-1-2026-07-13T08-00-00-000Z"
    )
    expect(smartDigestJobId("rule/1", scheduledFor)).not.toBe(
      smartDigestJobId("rule/1", "2026-07-14T08:00:00.000Z")
    )
  })

  it("enqueues scheduled digest runs with bounded retries", async () => {
    const { enqueueSmartDigestRule, smartDigestJobId } = await import(
      "./smart-digest-queue"
    )
    const data = { ruleId: "rule-1", scheduledFor }

    await enqueueSmartDigestRule(data)

    expect(queueAdd).toHaveBeenCalledWith(
      "generate-smart-digest",
      data,
      {
        attempts: 3,
        backoff: {
          delay: 10_000,
          type: "exponential",
        },
        jobId: smartDigestJobId(data.ruleId, data.scheduledFor),
        removeOnComplete: true,
        removeOnFail: {
          age: 24 * 60 * 60,
          count: 1000,
        },
      }
    )
  })
})

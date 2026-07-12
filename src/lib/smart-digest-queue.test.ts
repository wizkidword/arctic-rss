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

  it("uses BullMQ-compatible job ids", async () => {
    const { smartDigestJobId } = await import("./smart-digest-queue")

    expect(smartDigestJobId("rule/1")).toBe("smart-digest-rule-1")
    expect(smartDigestJobId("rule:2")).toBe("smart-digest-rule-2")
  })

  it("enqueues smart digest rules with stable defaults", async () => {
    const { enqueueSmartDigestRule, smartDigestJobId } = await import(
      "./smart-digest-queue"
    )

    await enqueueSmartDigestRule("rule-1")

    expect(queueAdd).toHaveBeenCalledWith(
      "generate-smart-digest",
      { ruleId: "rule-1" },
      {
        attempts: 3,
        backoff: {
          delay: 10_000,
          type: "exponential",
        },
        jobId: smartDigestJobId("rule-1"),
        removeOnComplete: true,
        removeOnFail: {
          age: 24 * 60 * 60,
          count: 1000,
        },
      }
    )
  })

  it("applies options overrides after defaults", async () => {
    const { enqueueSmartDigestRule } = await import("./smart-digest-queue")

    await enqueueSmartDigestRule("rule-1", {
      attempts: 1,
      jobId: "manual-job",
    })

    expect(queueAdd).toHaveBeenCalledWith(
      "generate-smart-digest",
      { ruleId: "rule-1" },
      {
        attempts: 1,
        backoff: {
          delay: 10_000,
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

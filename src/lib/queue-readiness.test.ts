import { describe, expect, it, vi } from "vitest"

import { inspectQueueReadinessWithClients, type QueueReadinessReader } from "./queue-readiness"

const now = () => 1_752_428_800_000

function reader({
  active = [],
  counts = { active: 0, failed: 0, waiting: 0 },
  failed = [],
  waiting = [],
}: {
  active?: Array<{ processedOn?: number; timestamp: number }>
  counts?: { active: number; failed: number; waiting: number }
  failed?: Array<{ finishedOn?: number; timestamp: number }>
  waiting?: Array<{ timestamp: number }>
} = {}): QueueReadinessReader {
  return {
    getJobCounts: vi.fn().mockResolvedValue(counts),
    getJobs: vi.fn().mockImplementation((types: string[]) => {
      if (types[0] === "active") {
        return active
      }
      if (types[0] === "failed") {
        return failed
      }
      return waiting
    }),
  }
}

describe("queue readiness", () => {
  it("accepts bounded queue work with no recent failures", async () => {
    const queue = reader({
      active: [{ processedOn: now() - 1_000, timestamp: now() - 2_000 }],
      counts: { active: 1, failed: 0, waiting: 1 },
      waiting: [{ timestamp: now() - 2_000 }],
    })

    await expect(
      inspectQueueReadinessWithClients({ queues: [{ name: "feed", reader: queue }], now })
    ).resolves.toEqual({
      available: true,
      oldestActiveJobAgeMs: 1_000,
      oldestWaitingJobAgeMs: 2_000,
      recentFailureCount: 0,
      ready: true,
      suspectedStalledJobCount: 0,
      totalActive: 1,
      totalWaiting: 1,
    })
    expect(queue.getJobCounts).toHaveBeenCalledWith("waiting", "active", "failed")
  })

  it("degrades for an excessively old waiting job", async () => {
    const queue = reader({ waiting: [{ timestamp: now() - 10_001 }] })

    const result = await inspectQueueReadinessWithClients({
      maxWaitingJobAgeMs: 10_000,
      now,
      queues: [{ name: "feed", reader: queue }],
    })

    expect(result).toMatchObject({
      oldestWaitingJobAgeMs: 10_001,
      ready: false,
    })
  })

  it("degrades for active jobs that have become suspected stalls", async () => {
    const queue = reader({
      active: [{ processedOn: now() - 10_001, timestamp: now() - 20_000 }],
    })

    const result = await inspectQueueReadinessWithClients({
      maxActiveJobAgeMs: 10_000,
      now,
      queues: [{ name: "feed", reader: queue }],
    })

    expect(result).toMatchObject({
      ready: false,
      suspectedStalledJobCount: 1,
    })
  })

  it("uses a bounded recent failed-job count instead of historical failures", async () => {
    const queue = reader({
      failed: [
        { finishedOn: now() - 100, timestamp: now() - 100 },
        { finishedOn: now() - 200, timestamp: now() - 200 },
        { finishedOn: now() - 20_000, timestamp: now() - 20_000 },
      ],
    })

    const result = await inspectQueueReadinessWithClients({
      maxRecentFailures: 1,
      now,
      queues: [{ name: "feed", reader: queue }],
      recentFailureWindowMs: 10_000,
    })

    expect(result).toMatchObject({ recentFailureCount: 2, ready: false })
  })

  it("fails closed when queue metadata cannot be read", async () => {
    const queue = reader()
    vi.mocked(queue.getJobCounts).mockRejectedValue(new Error("connect ECONNREFUSED"))

    await expect(
      inspectQueueReadinessWithClients({ queues: [{ name: "feed", reader: queue }], now })
    ).resolves.toMatchObject({ available: false, ready: false })
  })
})

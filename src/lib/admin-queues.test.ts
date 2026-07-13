import { describe, expect, it, vi } from "vitest"

import {
  ADMIN_QUEUE_LABELS,
  inspectAdminQueuesWithClients,
  type AdminQueueReader,
} from "./admin-queues"

function createQueue({
  counts,
  jobs,
}: {
  counts: {
    active: number
    delayed: number
    failed: number
    waiting: number
  }
  jobs: Array<{
    attemptsMade: number
    failedReason: string
    finishedOn?: number
    id?: string
    name: string
    timestamp: number
  }>
}): AdminQueueReader {
  return {
    getJobCounts: vi.fn().mockResolvedValue(counts),
    getJobs: vi.fn().mockResolvedValue(jobs),
  }
}

describe("admin queue inspection", () => {
  it("lists every worker queue in the operational dashboard", () => {
    expect(Object.values(ADMIN_QUEUE_LABELS)).toEqual([
      "AI digest",
      "Bulk mark read",
      "Feed refresh",
      "OPML import",
      "Podcast refresh",
      "Smart Digest",
      "Smart Digest email",
    ])
  })

  it("maps queue counts and recent failed jobs newest first", async () => {
    const feedQueue = createQueue({
      counts: {
        active: 1,
        delayed: 2,
        failed: 1,
        waiting: 3,
      },
      jobs: [
        {
          attemptsMade: 3,
          failedReason: "Feed endpoint returned HTTP 503.",
          finishedOn: Date.parse("2026-06-24T06:30:00.000Z"),
          id: "feed-feed-1",
          name: "refresh-feed",
          timestamp: Date.parse("2026-06-24T06:00:00.000Z"),
        },
      ],
    })
    const digestQueue = createQueue({
      counts: {
        active: 0,
        delayed: 0,
        failed: 1,
        waiting: 1,
      },
      jobs: [
        {
          attemptsMade: 2,
          failedReason: "AI provider unavailable.",
          finishedOn: Date.parse("2026-06-24T07:15:00.000Z"),
          id: "digest-digest-1",
          name: "generate-digest",
          timestamp: Date.parse("2026-06-24T07:00:00.000Z"),
        },
      ],
    })

    const snapshot = await inspectAdminQueuesWithClients({
      queues: [
        { name: "Feed refresh", reader: feedQueue },
        { name: "AI digest", reader: digestQueue },
      ],
    })

    expect(feedQueue.getJobCounts).toHaveBeenCalledWith(
      "waiting",
      "active",
      "delayed",
      "failed"
    )
    expect(feedQueue.getJobs).toHaveBeenCalledWith(["failed"], 0, 24, false)
    expect(snapshot).toEqual({
      available: true,
      failedJobs: [
        {
          attemptsMade: 2,
          failedReason: "AI provider unavailable.",
          id: "digest-digest-1",
          jobName: "generate-digest",
          occurredAt: new Date("2026-06-24T07:15:00.000Z"),
          queueName: "AI digest",
        },
        {
          attemptsMade: 3,
          failedReason: "Feed endpoint returned HTTP 503.",
          id: "feed-feed-1",
          jobName: "refresh-feed",
          occurredAt: new Date("2026-06-24T06:30:00.000Z"),
          queueName: "Feed refresh",
        },
      ],
      queues: [
        {
          active: 1,
          delayed: 2,
          failed: 1,
          name: "Feed refresh",
          waiting: 3,
        },
        {
          active: 0,
          delayed: 0,
          failed: 1,
          name: "AI digest",
          waiting: 1,
        },
      ],
    })
  })

  it("returns an unavailable snapshot instead of throwing on Redis errors", async () => {
    const feedQueue = createQueue({
      counts: {
        active: 0,
        delayed: 0,
        failed: 0,
        waiting: 0,
      },
      jobs: [],
    })
    const digestQueue = createQueue({
      counts: {
        active: 0,
        delayed: 0,
        failed: 0,
        waiting: 0,
      },
      jobs: [],
    })
    vi.mocked(feedQueue.getJobCounts).mockRejectedValue(
      new Error("connect ECONNREFUSED")
    )

    await expect(
      inspectAdminQueuesWithClients({
        queues: [
          { name: "Feed refresh", reader: feedQueue },
          { name: "AI digest", reader: digestQueue },
        ],
      })
    ).resolves.toEqual({
      available: false,
      error: "Queue status is temporarily unavailable.",
      failedJobs: [],
      queues: [],
    })
  })

  it("bounds failure messages and supplies stable fallback identifiers", async () => {
    const feedQueue = createQueue({
      counts: {
        active: 0,
        delayed: 0,
        failed: 1,
        waiting: 0,
      },
      jobs: [
        {
          attemptsMade: 1,
          failedReason: "x".repeat(700),
          name: "refresh-feed",
          timestamp: Date.parse("2026-06-24T06:00:00.000Z"),
        },
      ],
    })
    const digestQueue = createQueue({
      counts: {
        active: 0,
        delayed: 0,
        failed: 0,
        waiting: 0,
      },
      jobs: [],
    })

    const snapshot = await inspectAdminQueuesWithClients({
      queues: [
        { name: "Feed refresh", reader: feedQueue },
        { name: "AI digest", reader: digestQueue },
      ],
    })

    expect(snapshot.available).toBe(true)
    if (!snapshot.available) {
      throw new Error("Expected queue inspection to be available.")
    }

    expect(snapshot.failedJobs[0]?.id).toBe("refresh-feed")
    expect(snapshot.failedJobs[0]?.failedReason).toHaveLength(500)
    expect(snapshot.failedJobs[0]?.failedReason.endsWith("...")).toBe(true)
  })

  it("shows each queue supplied by the admin inspection", async () => {
    const emptyQueue = createQueue({
      counts: {
        active: 0,
        delayed: 0,
        failed: 0,
        waiting: 0,
      },
      jobs: [],
    })

    const snapshot = await inspectAdminQueuesWithClients({
      queues: [
        { name: "Feed refresh", reader: emptyQueue },
        { name: "Podcast refresh", reader: emptyQueue },
        { name: "AI digest", reader: emptyQueue },
        { name: "Bulk mark read", reader: emptyQueue },
        { name: "Smart Digest", reader: emptyQueue },
        { name: "Smart Digest email", reader: emptyQueue },
        { name: "OPML import", reader: emptyQueue },
      ],
    })

    expect(snapshot).toMatchObject({
      available: true,
      queues: [
        { name: "Feed refresh" },
        { name: "Podcast refresh" },
        { name: "AI digest" },
        { name: "Bulk mark read" },
        { name: "Smart Digest" },
        { name: "Smart Digest email" },
        { name: "OPML import" },
      ],
    })
  })
})

import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  enqueueOpmlImportJob: vi.fn(),
  getPrisma: vi.fn(),
  parseOpmlSubscriptions: vi.fn(),
}))

vi.mock("./db", () => ({
  getPrisma: mocks.getPrisma,
}))

vi.mock("./feed-refresh-queue", () => ({
  enqueueFeedRefresh: vi.fn(),
}))

vi.mock("./feed-subscriptions", () => ({
  FeedSubscriptionError: class FeedSubscriptionError extends Error {},
  subscribeToFeed: vi.fn(),
}))

vi.mock("./opml-import-queue", () => ({
  enqueueOpmlImportJob: mocks.enqueueOpmlImportJob,
}))

vi.mock("./opml", () => ({
  parseOpmlSubscriptions: mocks.parseOpmlSubscriptions,
}))

import {
  cancelOpmlImportJob,
  createOpmlImportJob,
  OpmlImportJobError,
  processOpmlImportJob,
  retryOpmlImportJob,
} from "./opml-import-jobs"

describe("OPML import jobs", () => {
  beforeEach(() => {
    mocks.enqueueOpmlImportJob.mockReset()
    mocks.getPrisma.mockReset()
    mocks.parseOpmlSubscriptions.mockReset()
  })

  it("persists the validated plan before queueing the background work", async () => {
    const create = vi.fn().mockResolvedValue({ id: "job-1" })
    const createMany = vi.fn().mockResolvedValue({ count: 2 })
    const transaction = {
      importJob: { create },
      importJobEntry: { createMany },
    }
    const prisma = {
      $transaction: vi.fn(
        async (callback: (client: typeof transaction) => Promise<unknown>) =>
          callback(transaction)
      ),
      importJob: {},
    }
    mocks.getPrisma.mockReturnValue(prisma)
    mocks.parseOpmlSubscriptions.mockReturnValue([
      {
        folderName: "Tech",
        title: "Example",
        xmlUrl: "https://example.com/feed.xml",
      },
      {
        folderName: null,
        title: "Second",
        xmlUrl: "https://second.example/feed.xml",
      },
    ])
    mocks.enqueueOpmlImportJob.mockResolvedValue({})

    const result = await createOpmlImportJob({
      opmlXml: "<opml />",
      userId: "user-1",
    })

    expect(result).toEqual({ jobId: "job-1", totalFeeds: 2 })
    expect(create).toHaveBeenCalledWith({
      data: {
        folderCount: 1,
        status: "PENDING",
        totalFeeds: 2,
        userId: "user-1",
      },
      select: { id: true },
    })
    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          folderName: "Tech",
          importJobId: "job-1",
          sequence: 0,
          title: "Example",
          xmlUrl: "https://example.com/feed.xml",
        },
        {
          folderName: null,
          importJobId: "job-1",
          sequence: 1,
          title: "Second",
          xmlUrl: "https://second.example/feed.xml",
        },
      ],
    })
    expect(mocks.enqueueOpmlImportJob).toHaveBeenCalledWith("job-1")
  })

  it("admits one of two simultaneous create requests and reports the other as active", async () => {
    const activeUsers = new Set<string>()
    let nextJob = 0
    const transaction = {
      importJob: {
        create: vi.fn(async ({ data }: { data: { userId: string } }) => {
          if (activeUsers.has(data.userId)) {
            throw { code: "P2002" }
          }
          activeUsers.add(data.userId)
          nextJob += 1
          return { id: `job-${nextJob}` }
        }),
      },
      importJobEntry: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
    }
    mocks.getPrisma.mockReturnValue({
      $transaction: vi.fn(
        async (callback: (client: typeof transaction) => Promise<unknown>) =>
          callback(transaction)
      ),
      importJob: {},
    })
    mocks.parseOpmlSubscriptions.mockReturnValue([])
    mocks.enqueueOpmlImportJob.mockResolvedValue({})

    const results = await Promise.allSettled([
      createOpmlImportJob({ opmlXml: "<opml />", userId: "user-1" }),
      createOpmlImportJob({ opmlXml: "<opml />", userId: "user-1" }),
    ])

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1)
    const rejected = results.find((result) => result.status === "rejected")
    expect(rejected?.status).toBe("rejected")
    if (rejected?.status === "rejected") {
      expect(rejected.reason).toBeInstanceOf(OpmlImportJobError)
      expect(rejected.reason.message).toMatch(/already running/i)
    }
    expect(mocks.enqueueOpmlImportJob).toHaveBeenCalledTimes(1)
  })

  it("frees a failed-to-enqueue job so the user can immediately start another", async () => {
    let active = false
    let nextJob = 0
    const create = vi.fn(async () => {
      if (active) {
        throw { code: "P2002" }
      }
      active = true
      nextJob += 1
      return { id: `job-${nextJob}` }
    })
    const update = vi.fn(async () => {
      active = false
      return { id: "job-1" }
    })
    const transaction = {
      importJob: { create },
      importJobEntry: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
    }
    mocks.getPrisma.mockReturnValue({
      $transaction: vi.fn(
        async (callback: (client: typeof transaction) => Promise<unknown>) =>
          callback(transaction)
      ),
      importJob: { update },
    })
    mocks.parseOpmlSubscriptions.mockReturnValue([])
    mocks.enqueueOpmlImportJob
      .mockRejectedValueOnce(new Error("queue unavailable"))
      .mockResolvedValueOnce({})

    await expect(
      createOpmlImportJob({ opmlXml: "<opml />", userId: "user-1" })
    ).rejects.toThrow("could not start")
    await expect(
      createOpmlImportJob({ opmlXml: "<opml />", userId: "user-1" })
    ).resolves.toEqual({ jobId: "job-2", totalFeeds: 0 })
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) })
    )
  })

  it("turns a concurrent retry conflict into the same active-import message", async () => {
    mocks.getPrisma.mockReturnValue({
      $transaction: vi.fn().mockRejectedValue({ code: "P2002" }),
      importJob: {
        findFirst: vi.fn().mockResolvedValue({ id: "job-1" }),
      },
    })

    await expect(
      retryOpmlImportJob({ jobId: "job-1", userId: "user-1" })
    ).rejects.toThrow("already running")
  })

  it("only accepts a cancel request for the owning user and an active import", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 })
    mocks.getPrisma.mockReturnValue({
      importJob: { updateMany },
    })

    await expect(
      cancelOpmlImportJob({
        jobId: "job-1",
        userId: "user-1",
      })
    ).resolves.toBe(true)
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "job-1",
          status: { in: ["PENDING", "PROCESSING"] },
          userId: "user-1",
        }),
      })
    )
  })

  it("cancels before external subscription work when the owner is disabled", async () => {
    const importJobFindUnique = vi.fn().mockResolvedValue({
      cancelRequestedAt: null,
      id: "job-1",
      startedAt: null,
      status: "PENDING",
      userId: "user-1",
    })
    const importJobUpdateMany = vi.fn().mockResolvedValue({ count: 1 })
    const userFindUnique = vi.fn().mockResolvedValue({
      disabledAt: new Date("2026-08-09T12:00:00.000Z"),
      emailVerified: new Date("2026-08-01T12:00:00.000Z"),
      id: "user-1",
      plan: "FREE",
    })
    mocks.getPrisma.mockReturnValue({
      importJob: {
        findUnique: importJobFindUnique,
        updateMany: importJobUpdateMany,
      },
      user: { findUnique: userFindUnique },
    })

    await expect(
      processOpmlImportJob({
        jobId: "job-1",
        now: () => new Date("2026-08-09T12:01:00.000Z"),
      })
    ).resolves.toEqual({ status: "CANCELED" })
    expect(importJobUpdateMany).toHaveBeenCalledWith({
      data: {
        completedAt: new Date("2026-08-09T12:01:00.000Z"),
        status: "CANCELED",
      },
      where: {
        id: "job-1",
        status: { in: ["PENDING", "PROCESSING"] },
      },
    })
  })
})

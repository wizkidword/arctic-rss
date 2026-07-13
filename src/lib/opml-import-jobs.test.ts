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
      importJob: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
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
})

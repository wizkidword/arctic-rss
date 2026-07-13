import { describe, expect, it, vi } from "vitest"

import {
  BULK_READ_SYNC_ARTICLE_LIMIT,
  cancelBulkReadJob,
  processBulkReadJob,
  startBulkRead,
} from "./bulk-read-jobs"

describe("bulk read jobs", () => {
  it("queues a large scope instead of holding the reader request open", async () => {
    const enqueue = vi.fn().mockResolvedValue({})
    const store = {
      article: {
        count: vi.fn().mockResolvedValue(BULK_READ_SYNC_ARTICLE_LIMIT + 1),
        findMany: vi.fn(),
      },
      articleState: {
        createMany: vi.fn(),
        updateMany: vi.fn(),
      },
      bulkReadJob: {
        create: vi.fn().mockResolvedValue({ id: "job-1" }),
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
    }

    const result = await startBulkRead({
      enqueue,
      scope: { type: "all" },
      store: store as never,
      userId: "user-1",
    })

    expect(result).toEqual({
      jobId: "job-1",
      status: "queued",
      totalArticles: BULK_READ_SYNC_ARTICLE_LIMIT + 1,
    })
    expect(store.article.findMany).not.toHaveBeenCalled()
    expect(enqueue).toHaveBeenCalledWith("job-1")
  })

  it("records bounded progress and completes a queued job", async () => {
    const job = {
      feedId: null,
      folderId: null,
      id: "job-1",
      lastArticleId: null as string | null,
      markedArticles: 0,
      processedArticles: 0,
      scopeType: "all",
      status: "QUEUED" as const,
      totalArticles: 3,
      userId: "user-1",
    }
    const articles = [{ id: "article-1" }, { id: "article-2" }, { id: "article-3" }]
    const progress = vi.fn()
    const store = {
      article: {
        count: vi.fn(),
        findMany: vi.fn(async () => {
          if (job.lastArticleId) {
            return []
          }

          return articles
        }),
      },
      articleState: {
        createMany: vi.fn().mockResolvedValue({ count: 3 }),
        updateMany: vi.fn().mockResolvedValue({ count: 3 }),
      },
      bulkReadJob: {
        create: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(async () => job),
        update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          Object.assign(job, data)
        }),
        updateMany: vi.fn(),
      },
    }

    const result = await processBulkReadJob({
      jobId: "job-1",
      now: () => new Date("2026-07-13T20:00:00.000Z"),
      onProgress: progress,
      store: store as never,
    })

    expect(result).toEqual({
      markedArticles: 3,
      processedArticles: 3,
      status: "COMPLETED",
    })
    expect(store.articleState.createMany).toHaveBeenCalledTimes(1)
    expect(store.articleState.updateMany).toHaveBeenCalledTimes(1)
    expect(store.bulkReadJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastArticleId: "article-3",
          markedArticles: 3,
          processedArticles: 3,
        }),
      })
    )
    expect(progress).toHaveBeenLastCalledWith(100)
  })

  it("cancels only the requesting user's active job", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 })

    const canceled = await cancelBulkReadJob({
      jobId: "job-1",
      store: {
        bulkReadJob: { updateMany },
      } as never,
      userId: "user-1",
    })

    expect(canceled).toBe(true)
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "job-1",
          userId: "user-1",
        }),
      })
    )
  })
})

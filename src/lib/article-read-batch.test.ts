import { describe, expect, it, vi } from "vitest"

import {
  ARTICLE_READ_BATCH_SIZE,
  writeArticleReadStateBatches,
} from "./article-read-batch"

function createStore() {
  return {
    articleState: {
      createMany: vi.fn().mockResolvedValue({ count: ARTICLE_READ_BATCH_SIZE }),
      updateMany: vi.fn().mockResolvedValue({ count: ARTICLE_READ_BATCH_SIZE }),
    },
  }
}

describe("article read-state batches", () => {
  it("marks a large library with bounded set-based writes", async () => {
    const store = createStore()
    const articleIds = Array.from({ length: 601 }, (_, index) => `article-${index}`)
    const readAt = new Date("2026-07-13T20:00:00.000Z")

    const result = await writeArticleReadStateBatches({
      articleIds,
      readAt,
      store,
      userId: "user-1",
    })

    expect(result).toEqual({ markedCount: 601 })
    expect(store.articleState.createMany).toHaveBeenCalledTimes(3)
    expect(store.articleState.updateMany).toHaveBeenCalledTimes(3)
    expect(store.articleState.createMany).toHaveBeenNthCalledWith(1, {
      data: articleIds.slice(0, ARTICLE_READ_BATCH_SIZE).map((articleId) => ({
        articleId,
        isRead: true,
        readAt,
        userId: "user-1",
      })),
      skipDuplicates: true,
    })
    expect(store.articleState.updateMany).toHaveBeenLastCalledWith({
      data: {
        isRead: true,
        readAt,
      },
      where: {
        articleId: {
          in: articleIds.slice(500),
        },
        userId: "user-1",
      },
    })
  })

  it("is idempotent when the same batch is retried", async () => {
    const store = createStore()
    const readAt = new Date("2026-07-13T20:00:00.000Z")
    const options = {
      articleIds: ["article-1", "article-2"],
      readAt,
      store,
      userId: "user-1",
    }

    await writeArticleReadStateBatches(options)
    await writeArticleReadStateBatches(options)

    expect(store.articleState.createMany).toHaveBeenCalledTimes(2)
    expect(store.articleState.createMany).toHaveBeenNthCalledWith(2, {
      data: [
        {
          articleId: "article-1",
          isRead: true,
          readAt,
          userId: "user-1",
        },
        {
          articleId: "article-2",
          isRead: true,
          readAt,
          userId: "user-1",
        },
      ],
      skipDuplicates: true,
    })
    expect(store.articleState.updateMany).toHaveBeenCalledTimes(2)
  })
})

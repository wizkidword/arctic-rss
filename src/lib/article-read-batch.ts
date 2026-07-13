export const ARTICLE_READ_BATCH_SIZE = 250

type ArticleReadBatchStore = {
  articleState: {
    createMany(args: {
      data: Array<{
        articleId: string
        isRead: boolean
        readAt: Date
        userId: string
      }>
      skipDuplicates: true
    }): Promise<{ count: number }>
    updateMany(args: {
      data: {
        isRead: boolean
        readAt: Date
      }
      where: {
        articleId: {
          in: string[]
        }
        userId: string
      }
    }): Promise<{ count: number }>
  }
}

/**
 * Marks a bounded set of articles as read with two set-based writes per batch.
 * Creating first, with duplicate suppression, makes a retry safe even if a
 * worker stops between the insert and update statements.
 */
export async function writeArticleReadStateBatches({
  articleIds,
  batchSize = ARTICLE_READ_BATCH_SIZE,
  readAt,
  store,
  userId,
}: {
  articleIds: string[]
  batchSize?: number
  readAt: Date
  store: ArticleReadBatchStore
  userId: string
}) {
  const uniqueArticleIds = [...new Set(articleIds)]
  const boundedBatchSize = Math.max(1, Math.floor(batchSize))

  for (let index = 0; index < uniqueArticleIds.length; index += boundedBatchSize) {
    const ids = uniqueArticleIds.slice(index, index + boundedBatchSize)

    await store.articleState.createMany({
      data: ids.map((articleId) => ({
        articleId,
        isRead: true,
        readAt,
        userId,
      })),
      skipDuplicates: true,
    })
    await store.articleState.updateMany({
      data: {
        isRead: true,
        readAt,
      },
      where: {
        articleId: {
          in: ids,
        },
        userId,
      },
    })
  }

  return {
    markedCount: uniqueArticleIds.length,
  }
}

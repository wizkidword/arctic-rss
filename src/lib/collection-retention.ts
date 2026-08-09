import { getPrisma } from "./db"

export type CollectionArticleRetention = {
  savedAt: Date
  sourceIsFollowed: boolean
}

export type CollectionArticleSource = {
  feedUrl: string
  sourceIsFollowed: boolean
  title: string
}

export class CollectionRetentionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CollectionRetentionError"
  }
}

export async function listCollectionArticleRetentionForUser({
  articleIds,
  collectionId,
  userId,
}: {
  articleIds: string[]
  collectionId: string
  userId: string
}): Promise<Map<string, CollectionArticleRetention>> {
  const items = await findCollectionArticleItems({
    articleIds,
    collectionId,
    userId,
  })

  return new Map(
    items.flatMap((item) => {
      if (!item.articleId || !item.article) {
        return []
      }

      return [
        [
          item.articleId,
          {
            savedAt: item.createdAt,
            sourceIsFollowed: item.article.feed.subscriptions.length > 0,
          },
        ],
      ]
    })
  )
}

export async function getCollectionArticleSourceForUser({
  articleId,
  collectionId,
  userId,
}: {
  articleId: string
  collectionId: string
  userId: string
}): Promise<CollectionArticleSource> {
  const items = await findCollectionArticleItems({
    articleIds: [articleId],
    collectionId,
    userId,
  })
  const item = items.find(
    (candidate) => candidate.articleId === articleId && candidate.article
  )

  if (!item?.article) {
    throw new CollectionRetentionError(
      "That saved collection article was not found."
    )
  }

  return {
    feedUrl: item.article.feed.feedUrl,
    sourceIsFollowed: item.article.feed.subscriptions.length > 0,
    title: item.article.feed.title,
  }
}

async function findCollectionArticleItems({
  articleIds,
  collectionId,
  userId,
}: {
  articleIds: string[]
  collectionId: string
  userId: string
}) {
  const uniqueArticleIds = [...new Set(articleIds.map((id) => id.trim()))].filter(
    Boolean
  )

  if (!uniqueArticleIds.length) {
    return []
  }

  return getPrisma().articleCollectionItem.findMany({
    select: {
      article: {
        select: {
          feed: {
            select: {
              feedUrl: true,
              subscriptions: {
                select: { id: true },
                take: 1,
                where: { userId },
              },
              title: true,
            },
          },
        },
      },
      articleId: true,
      createdAt: true,
    },
    where: {
      articleId: { in: uniqueArticleIds },
      collection: {
        id: collectionId,
        userId,
      },
    },
  })
}

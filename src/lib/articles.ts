import sanitizeHtml from "sanitize-html"

import { Prisma } from "../generated/prisma/client"
import { getPrisma } from "./db"

type ArticleLookup = {
  id: string
}

export type ReaderArticleAiSummary = {
  bulletSummary: string[]
  category: string | null
  id: string
  keyTakeaway: string | null
  model: string
  provider: string
  readingTimeSeconds: number | null
  sentiment: string | null
  shortSummary: string
  tokenCount: number | null
}

type ArticleStateStore = {
  article: {
    findFirst(args: {
      select: { id: true }
      where: Prisma.ArticleWhereInput
    }): Promise<ArticleLookup | null>
    findMany(args: {
      select: { id: true }
      where: Prisma.ArticleWhereInput
    }): Promise<ArticleLookup[]>
  }
  articleState: {
    upsert(args: {
      create: Record<string, unknown>
      update: Record<string, unknown>
      where: {
        userId_articleId: {
          articleId: string
          userId: string
        }
      }
    }): Promise<unknown>
  }
}

export type ReaderArticle = {
  aiSummary: ReaderArticleAiSummary | null
  author: string | null
  contentHtml: string | null
  contentText: string | null
  feedId: string
  feedTitle: string
  id: string
  imageUrl: string | null
  isRead: boolean
  isStarred: boolean
  publishedAt: Date | null
  readAt: Date | null
  sanitizedContentHtml: string | null
  starredAt: Date | null
  summary: string | null
  title: string
  url: string
}

type ReaderArticleRecord = {
  aiSummaries: Array<{
    bulletSummary: unknown
    category: string | null
    id: string
    keyTakeaway: string | null
    model: string
    provider: string
    readingTimeSeconds: number | null
    sentiment: string | null
    shortSummary: string
    tokenCount: number | null
  }>
  author: string | null
  contentHtml: string | null
  contentText: string | null
  feed: {
    id: string
    title: string
  }
  feedId: string
  id: string
  imageUrl: string | null
  publishedAt: Date | null
  states: Array<{
    isRead: boolean
    isStarred: boolean
    readAt: Date | null
    starredAt: Date | null
  }>
  summary: string | null
  title: string
  url: string
}

export type ArticleListFilters = {
  feedId?: string
  folderId?: string
  limit?: number
  starredOnly?: boolean
  unreadOnly?: boolean
  userId: string
}

export type ArticleReadScope =
  | {
      type: "all"
    }
  | {
      feedId: string
      type: "feed"
    }
  | {
      folderId: string
      type: "folder"
    }

export class ArticleStateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ArticleStateError"
  }
}

export function sanitizeArticleHtml(html: string | null | undefined) {
  if (!html) {
    return null
  }

  const sanitized = sanitizeHtml(html, {
    allowedAttributes: {
      a: ["href", "name", "rel", "target"],
      blockquote: ["cite"],
      img: ["alt", "height", "src", "title", "width"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedTags: [
      "a",
      "b",
      "blockquote",
      "br",
      "code",
      "em",
      "figcaption",
      "figure",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "hr",
      "i",
      "img",
      "li",
      "ol",
      "p",
      "pre",
      "strong",
      "ul",
    ],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "nofollow noreferrer",
        target: "_blank",
      }),
    },
  }).trim()

  return sanitized || null
}

export async function listReaderArticles({
  feedId,
  folderId,
  limit = 50,
  starredOnly = false,
  unreadOnly = false,
  userId,
}: ArticleListFilters): Promise<ReaderArticle[]> {
  const articles = await getPrisma().article.findMany({
    include: readerArticleInclude(userId),
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
    where: articleListWhere({
      feedId,
      folderId,
      starredOnly,
      unreadOnly,
      userId,
    }),
  })

  return articles.map((article) => mapReaderArticle(article))
}

export async function getReaderArticleForUser({
  articleId,
  userId,
}: {
  articleId: string
  userId: string
}) {
  const article = await getPrisma().article.findFirst({
    include: readerArticleInclude(userId),
    where: {
      AND: [subscribedArticleWhere(userId), { id: articleId }],
    },
  })

  return article ? mapReaderArticle(article) : null
}

export async function getReaderCounts(userId: string) {
  const prisma = getPrisma()
  const [allCount, unreadCount, starredCount] = await Promise.all([
    prisma.article.count({
      where: subscribedArticleWhere(userId),
    }),
    prisma.article.count({
      where: {
        AND: [
          subscribedArticleWhere(userId),
          {
            states: {
              none: {
                isRead: true,
                userId,
              },
            },
          },
        ],
      },
    }),
    prisma.article.count({
      where: {
        AND: [
          subscribedArticleWhere(userId),
          {
            states: {
              some: {
                isStarred: true,
                userId,
              },
            },
          },
        ],
      },
    }),
  ])

  return {
    allCount,
    starredCount,
    unreadCount,
  }
}

export async function countUnreadArticlesForFeed(userId: string, feedId: string) {
  return getPrisma().article.count({
    where: {
      AND: [
        subscribedArticleWhere(userId),
        { feedId },
        {
          states: {
            none: {
              isRead: true,
              userId,
            },
          },
        },
      ],
    },
  })
}

export async function setArticleReadState({
  articleId,
  isRead,
  userId,
}: {
  articleId: string
  isRead: boolean
  userId: string
}) {
  return setArticleReadStateWithClient({
    articleId,
    isRead,
    store: getArticleStateStore(),
    userId,
  })
}

export async function setArticleReadStateWithClient({
  articleId,
  isRead,
  now = () => new Date(),
  store,
  userId,
}: {
  articleId: string
  isRead: boolean
  now?: () => Date
  store: ArticleStateStore
  userId: string
}) {
  await assertArticleBelongsToUser({ articleId, store, userId })

  const readAt = isRead ? now() : null

  await store.articleState.upsert({
    create: {
      articleId,
      isRead,
      readAt,
      userId,
    },
    update: {
      isRead,
      readAt,
    },
    where: {
      userId_articleId: {
        articleId,
        userId,
      },
    },
  })
}

export async function setArticleStarredState({
  articleId,
  isStarred,
  userId,
}: {
  articleId: string
  isStarred: boolean
  userId: string
}) {
  return setArticleStarredStateWithClient({
    articleId,
    isStarred,
    store: getArticleStateStore(),
    userId,
  })
}

export async function setArticleStarredStateWithClient({
  articleId,
  isStarred,
  now = () => new Date(),
  store,
  userId,
}: {
  articleId: string
  isStarred: boolean
  now?: () => Date
  store: ArticleStateStore
  userId: string
}) {
  await assertArticleBelongsToUser({ articleId, store, userId })

  const starredAt = isStarred ? now() : null

  await store.articleState.upsert({
    create: {
      articleId,
      isStarred,
      starredAt,
      userId,
    },
    update: {
      isStarred,
      starredAt,
    },
    where: {
      userId_articleId: {
        articleId,
        userId,
      },
    },
  })
}

export async function markArticlesRead({
  scope,
  userId,
}: {
  scope: ArticleReadScope
  userId: string
}) {
  return markArticlesReadWithClient({
    scope,
    store: getArticleStateStore(),
    userId,
  })
}

export async function markArticlesReadWithClient({
  now = () => new Date(),
  scope,
  store,
  userId,
}: {
  now?: () => Date
  scope: ArticleReadScope
  store: ArticleStateStore
  userId: string
}) {
  const readAt = now()
  const articles = await store.article.findMany({
    select: { id: true },
    where: articleReadScopeWhere(userId, scope),
  })

  for (const article of articles) {
    await store.articleState.upsert({
      create: {
        articleId: article.id,
        isRead: true,
        readAt,
        userId,
      },
      update: {
        isRead: true,
        readAt,
      },
      where: {
        userId_articleId: {
          articleId: article.id,
          userId,
        },
      },
    })
  }

  return {
    markedCount: articles.length,
  }
}

function normalizeBulletSummary(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((bullet): bullet is string => typeof bullet === "string")
}

function readerArticleInclude(userId: string) {
  return {
    aiSummaries: {
      orderBy: {
        createdAt: "desc",
      },
      select: {
        bulletSummary: true,
        category: true,
        id: true,
        keyTakeaway: true,
        model: true,
        provider: true,
        readingTimeSeconds: true,
        sentiment: true,
        shortSummary: true,
        tokenCount: true,
      },
      take: 1,
    },
    feed: {
      select: {
        id: true,
        title: true,
      },
    },
    states: {
      take: 1,
      where: {
        userId,
      },
    },
  } satisfies Prisma.ArticleInclude
}

function mapReaderArticle(article: ReaderArticleRecord): ReaderArticle {
  const state = article.states[0]
  const aiSummary = article.aiSummaries[0]

  return {
    aiSummary: aiSummary
      ? {
          bulletSummary: normalizeBulletSummary(aiSummary.bulletSummary),
          category: aiSummary.category,
          id: aiSummary.id,
          keyTakeaway: aiSummary.keyTakeaway,
          model: aiSummary.model,
          provider: aiSummary.provider,
          readingTimeSeconds: aiSummary.readingTimeSeconds,
          sentiment: aiSummary.sentiment,
          shortSummary: aiSummary.shortSummary,
          tokenCount: aiSummary.tokenCount,
        }
      : null,
    author: article.author,
    contentHtml: article.contentHtml,
    contentText: article.contentText,
    feedId: article.feedId,
    feedTitle: article.feed.title,
    id: article.id,
    imageUrl: article.imageUrl,
    isRead: state?.isRead ?? false,
    isStarred: state?.isStarred ?? false,
    publishedAt: article.publishedAt,
    readAt: state?.readAt ?? null,
    sanitizedContentHtml: sanitizeArticleHtml(article.contentHtml),
    starredAt: state?.starredAt ?? null,
    summary: article.summary,
    title: article.title,
    url: article.url,
  }
}

function articleListWhere({
  feedId,
  folderId,
  starredOnly,
  unreadOnly,
  userId,
}: Required<Pick<ArticleListFilters, "starredOnly" | "unreadOnly" | "userId">> &
  Pick<ArticleListFilters, "feedId" | "folderId">): Prisma.ArticleWhereInput {
  const filters: Prisma.ArticleWhereInput[] = [subscribedArticleWhere(userId)]

  if (feedId) {
    filters.push({ feedId })
  }

  if (folderId) {
    filters.push(folderArticleWhere(userId, folderId))
  }

  if (unreadOnly) {
    filters.push({
      states: {
        none: {
          isRead: true,
          userId,
        },
      },
    })
  }

  if (starredOnly) {
    filters.push({
      states: {
        some: {
          isStarred: true,
          userId,
        },
      },
    })
  }

  return {
    AND: filters,
  }
}

function articleReadScopeWhere(
  userId: string,
  scope: ArticleReadScope
): Prisma.ArticleWhereInput {
  if (scope.type === "feed") {
    return {
      feedId: scope.feedId,
      feed: {
        subscriptions: {
          some: {
            userId,
          },
        },
      },
    }
  }

  if (scope.type === "folder") {
    return folderArticleWhere(userId, scope.folderId)
  }

  return subscribedArticleWhere(userId)
}

function folderArticleWhere(
  userId: string,
  folderId: string
): Prisma.ArticleWhereInput {
  return {
    feed: {
      subscriptions: {
        some: {
          folderId,
          isPaused: false,
          userId,
        },
      },
    },
  }
}

function subscribedArticleWhere(userId: string): Prisma.ArticleWhereInput {
  return {
    feed: {
      subscriptions: {
        some: {
          isPaused: false,
          userId,
        },
      },
    },
  }
}

async function assertArticleBelongsToUser({
  articleId,
  store,
  userId,
}: {
  articleId: string
  store: ArticleStateStore
  userId: string
}) {
  const article = await store.article.findFirst({
    select: { id: true },
    where: {
      feed: {
        subscriptions: {
          some: {
            userId,
          },
        },
      },
      id: articleId,
    },
  })

  if (!article) {
    throw new ArticleStateError("Article not found.")
  }
}

function getArticleStateStore() {
  return getPrisma() as unknown as ArticleStateStore
}

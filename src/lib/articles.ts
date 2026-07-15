import sanitizeHtml from "sanitize-html"

import { Prisma } from "../generated/prisma/client"
import { getPrisma } from "./db"
import { getDiscoverDirectory } from "./discover-directory"
import { imageProxyUrl } from "./image-proxy-url"
import { writeArticleReadStateBatches } from "./article-read-batch"
import {
  afterTimeCursorWhere,
  decodeTimeCursor,
  encodeTimeCursor,
  pageSize,
} from "./time-cursor"

const PUBLIC_GUEST_PREVIEW_USER_ID = "__public_guest_preview__"

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

type PublicReaderArticleStore = {
  article: {
    findMany(args: {
      include: unknown
      orderBy: Array<{ publishedAt: "desc" } | { createdAt: "desc" }>
      take: number
      where: Prisma.ArticleWhereInput
    }): Promise<ReaderArticleRecord[]>
  }
}

declare const sanitizedArticleHtmlBrand: unique symbol

export type SanitizedArticleHtml = string & {
  readonly [sanitizedArticleHtmlBrand]: true
}

export type ReaderArticle = {
  aiSummary: ReaderArticleAiSummary | null
  author: string | null
  contentText: string | null
  feedFaviconUrl: string | null
  feedId: string
  feedTitle: string
  id: string
  imageUrl: string | null
  isRead: boolean
  isStarred: boolean
  publishedAt: Date | null
  readAt: Date | null
  sanitizedContentHtml: SanitizedArticleHtml | null
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
    faviconUrl: string | null
    id: string
    title: string
  }
  feedId: string
  id: string
  imageUrl: string | null
  publishedAt: Date | null
  states: Array<{
    archivedAt: Date | null
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
  after?: string
  collectionId?: string
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

export function sanitizeArticleHtml(
  html: string | null | undefined
): SanitizedArticleHtml | null {
  if (!html) {
    return null
  }

  const sanitized = sanitizeHtml(html, {
    allowedAttributes: {
      a: ["href", "name", "rel", "target"],
      blockquote: ["cite"],
      img: ["alt", "height", "loading", "referrerpolicy", "src", "title", "width"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: {
      a: ["http", "https", "mailto"],
      img: ["http", "https"],
    },
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
    exclusiveFilter: (frame) =>
      frame.tag === "img" &&
      (isTrackingPixel(frame.attribs) || !imageProxyUrl(frame.attribs.src)),
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "nofollow noreferrer",
        target: "_blank",
      }),
      img: (tagName, attribs) => {
        const proxiedSrc = imageProxyUrl(attribs.src)

        if (!proxiedSrc) {
          return { attribs: {}, tagName }
        }

        return {
          attribs: {
            ...attribs,
            loading: "lazy",
            referrerpolicy: "no-referrer",
            src: proxiedSrc,
          },
          tagName,
        }
      },
    },
  }).trim()

  return sanitized ? (sanitized as SanitizedArticleHtml) : null
}

function isTrackingPixel(attributes: Record<string, string>) {
  const width = parseImageDimension(attributes.width)
  const height = parseImageDimension(attributes.height)

  return width !== null && height !== null && width <= 1 && height <= 1
}

function parseImageDimension(value: string | undefined) {
  if (!value || !/^\d+(?:\.\d+)?$/.test(value)) {
    return null
  }

  const dimension = Number(value)

  return Number.isFinite(dimension) ? dimension : null
}

export async function listReaderArticles({
  after,
  collectionId,
  feedId,
  folderId,
  limit = 50,
  starredOnly = false,
  unreadOnly = false,
  userId,
}: ArticleListFilters): Promise<ReaderArticle[]> {
  const page = await listReaderArticlePage({
    after,
    collectionId,
    feedId,
    folderId,
    limit,
    starredOnly,
    unreadOnly,
    userId,
  })

  return page.articles
}

export async function listReaderArticlePage({
  after,
  collectionId,
  feedId,
  folderId,
  limit = 50,
  starredOnly = false,
  unreadOnly = false,
  userId,
}: ArticleListFilters): Promise<ReaderArticlePage> {
  const boundedLimit = pageSize(limit)
  const cursor = decodeTimeCursor(after)
  const baseWhere = articleListWhere({
    collectionId,
    feedId,
    folderId,
    starredOnly,
    unreadOnly,
    userId,
  })
  const articles = await getPrisma().article.findMany({
    include: readerArticleInclude(userId),
    orderBy: [
      { publishedAt: { nulls: "last", sort: "desc" } },
      { createdAt: "desc" },
      { id: "desc" },
    ],
    take: boundedLimit + 1,
    where: cursor
      ? {
          AND: [baseWhere, afterTimeCursorWhere(cursor, "publishedAt")],
        }
      : baseWhere,
  })
  const visibleArticles = articles.slice(0, boundedLimit)

  return {
    articles: visibleArticles.map((article) => mapReaderArticle(article)),
    nextCursor:
      articles.length > boundedLimit && visibleArticles.length
        ? encodeTimeCursor(visibleArticles.at(-1)!)
        : null,
  }
}

export async function listPublicReaderArticles({
  limit = 50,
}: {
  limit?: number
} = {}) {
  const directory = await getDiscoverDirectory()
  const publicFeedUrls = [
    ...new Set(
      directory.feeds.flatMap((feed) => [feed.url, ...(feed.aliases ?? [])])
    ),
  ]

  return listPublicReaderArticlesWithClient({
    limit,
    publicFeedUrls,
    store: getPrisma() as unknown as PublicReaderArticleStore,
  })
}

export async function listPublicReaderArticlesWithClient({
  limit = 50,
  publicFeedUrls,
  store,
}: {
  limit?: number
  publicFeedUrls: readonly string[]
  store: PublicReaderArticleStore
}): Promise<ReaderArticle[]> {
  const boundedLimit = pageSize(limit)
  const articles = await store.article.findMany({
    include: readerArticleInclude(PUBLIC_GUEST_PREVIEW_USER_ID),
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    // A publisher can appear in more than one Discover entry. Fetch a small
    // buffer so deduplication still leaves a useful guest preview.
    take: boundedLimit * 3,
    where: {
      feed: {
        feedUrl: {
          in: [...publicFeedUrls],
        },
      },
    },
  })

  const seenUrls = new Set<string>()

  return articles
    .map((article) => mapReaderArticle(article))
    .filter((article) => {
      if (seenUrls.has(article.url)) {
        return false
      }

      seenUrls.add(article.url)
      return true
    })
    .slice(0, boundedLimit)
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
      AND: [
        subscribedArticleWhere(userId),
        { id: articleId },
        notArchivedArticleWhere(userId),
      ],
    },
  })

  return article ? mapReaderArticle(article) : null
}

export async function getReaderCounts(userId: string) {
  const prisma = getPrisma()
  const [allCount, unreadCount, starredCount] = await Promise.all([
    prisma.article.count({
      where: {
        AND: [subscribedArticleWhere(userId), notArchivedArticleWhere(userId)],
      },
    }),
    prisma.article.count({
      where: {
        AND: [
          subscribedArticleWhere(userId),
          notArchivedArticleWhere(userId),
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
          notArchivedArticleWhere(userId),
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
        notArchivedArticleWhere(userId),
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

export type ReaderArticlePage = {
  articles: ReaderArticle[]
  nextCursor: string | null
}

/**
 * Returns unread counts for a set of subscribed feeds with one grouped query.
 * Navigation uses this instead of issuing one count query per feed or folder.
 */
export async function getUnreadArticleCountsByFeed(
  userId: string,
  feedIds: string[]
) {
  const uniqueFeedIds = [...new Set(feedIds)]

  if (uniqueFeedIds.length === 0) {
    return new Map<string, number>()
  }

  const counts = await getPrisma().article.groupBy({
    _count: {
      _all: true,
    },
    by: ["feedId"],
    where: {
      AND: [
        subscribedArticleWhere(userId),
        {
          feedId: {
            in: uniqueFeedIds,
          },
        },
        notArchivedArticleWhere(userId),
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

  return new Map(
    counts.map((count) => [count.feedId, count._count._all])
  )
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

export async function deleteArticleForUser({
  articleId,
  userId,
}: {
  articleId: string
  userId: string
}) {
  return deleteArticleForUserWithClient({
    articleId,
    store: getArticleStateStore(),
    userId,
  })
}

export async function deleteArticleForUserWithClient({
  articleId,
  now = () => new Date(),
  store,
  userId,
}: {
  articleId: string
  now?: () => Date
  store: ArticleStateStore
  userId: string
}) {
  await assertArticleBelongsToUser({ articleId, store, userId })

  const archivedAt = now()

  await store.articleState.upsert({
    create: {
      archivedAt,
      articleId,
      isRead: true,
      readAt: archivedAt,
      userId,
    },
    update: {
      archivedAt,
      isRead: true,
      readAt: archivedAt,
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

  await writeArticleReadStateBatches({
    articleIds: articles.map((article) => article.id),
    readAt,
    store,
    userId,
  })

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
        faviconUrl: true,
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
    contentText: article.contentText,
    feedFaviconUrl: article.feed.faviconUrl,
    feedId: article.feedId,
    feedTitle: article.feed.title,
    id: article.id,
    imageUrl: imageProxyUrl(article.imageUrl),
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
  collectionId,
  feedId,
  folderId,
  starredOnly,
  unreadOnly,
  userId,
}: Required<Pick<ArticleListFilters, "starredOnly" | "unreadOnly" | "userId">> &
  Pick<
    ArticleListFilters,
    "collectionId" | "feedId" | "folderId"
  >): Prisma.ArticleWhereInput {
  const filters: Prisma.ArticleWhereInput[] = collectionId
    ? [collectionArticleWhere(userId, collectionId)]
    : [subscribedArticleWhere(userId)]

  filters.push(notArchivedArticleWhere(userId))

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

function notArchivedArticleWhere(userId: string): Prisma.ArticleWhereInput {
  return {
    states: {
      none: {
        archivedAt: {
          not: null,
        },
        userId,
      },
    },
  }
}

function collectionArticleWhere(
  userId: string,
  collectionId: string
): Prisma.ArticleWhereInput {
  return {
    collectionItems: {
      some: {
        collection: {
          userId,
        },
        collectionId,
      },
    },
  }
}

export function articleReadScopeWhere(
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

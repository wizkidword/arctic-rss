import { Prisma } from "../generated/prisma/client"
import { getPrisma } from "./db"
import { getDiscoverDirectory } from "./discover-directory"
import { writeArticleReadStateBatches } from "./article-read-batch"
import {
  mapReaderArticle,
  mapReaderArticleListItem,
  mapStoryClusterArticle,
  readerArticleInclude,
  readerArticleListSelect,
  storyClusterArticleSelect,
  type PublicReaderArticleListStore,
  type ReaderArticle,
  type ReaderArticleListItem,
  type ReaderArticleListItemsStore,
  type ReaderArticleListStore,
  type ReaderArticleStore,
  type StoryClusterArticleProjection,
  type StoryClusterArticleStore,
} from "./articles/reader-projections"
import {
  afterTimeCursorWhere,
  decodeTimeCursor,
  encodeTimeCursor,
  pageSize,
} from "./time-cursor"
export { sanitizeArticleHtml, type SanitizedArticleHtml } from "./articles/sanitization"
export type {
  ReaderArticle,
  ReaderArticleAiSummary,
  ReaderArticleListItem,
  StoryClusterArticleProjection,
} from "./articles/reader-projections"

const PUBLIC_GUEST_PREVIEW_USER_ID = "__public_guest_preview__"

type ArticleLookup = {
  id: string
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

export type ReaderArticleViewData = {
  riverArticles: ReaderArticle[]
  selectedArticle: ReaderArticle | null
}

export const RIVER_READER_DETAIL_LIMIT = 10
export const DEFAULT_READER_PAGE_LIMIT = 50

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
    take: boundedLimit,
    where: cursor
      ? {
          AND: [baseWhere, afterTimeCursorWhere(cursor, "publishedAt")],
        }
      : baseWhere,
  })

  return articles.map((article) => mapReaderArticle(article))
}

/**
 * Lists only the metadata needed for reader navigation and cards. Full article
 * content is loaded separately for the selected item so normal reader pages do
 * not transfer or sanitize every stored body.
 */
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
  return listReaderArticlePageWithClient({
    after,
    collectionId,
    feedId,
    folderId,
    limit,
    starredOnly,
    unreadOnly,
    store: getPrisma() as unknown as ReaderArticleListStore,
    userId,
  })
}

export async function listReaderArticlePageWithClient({
  after,
  collectionId,
  feedId,
  folderId,
  limit = 50,
  starredOnly = false,
  store,
  unreadOnly = false,
  userId,
}: ArticleListFilters & {
  store: ReaderArticleListStore
}): Promise<ReaderArticlePage> {
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
  const articles = await store.article.findMany({
    orderBy: [
      { publishedAt: { nulls: "last", sort: "desc" } },
      { createdAt: "desc" },
      { id: "desc" },
    ],
    select: readerArticleListSelect(userId),
    take: boundedLimit + 1,
    where: cursor
      ? {
          AND: [baseWhere, afterTimeCursorWhere(cursor, "publishedAt")],
        }
      : baseWhere,
  })
  const visibleArticles = articles.slice(0, boundedLimit)

  return {
    articles: visibleArticles.map((article) => mapReaderArticleListItem(article)),
    nextCursor:
      articles.length > boundedLimit && visibleArticles.length
        ? encodeTimeCursor(visibleArticles.at(-1)!)
        : null,
  }
}

/**
 * Resolves the visible reader detail without allowing a query parameter to
 * bypass the list page's authorization and filter boundary. River mode is
 * intentionally capped at ten detailed bodies per page.
 */
export async function loadReaderArticleView({
  articleIds,
  defaultView,
  displayMode,
  selectedArticleId,
  userId,
}: {
  articleIds: string[]
  defaultView: string
  displayMode: string
  selectedArticleId?: string
  userId: string
}): Promise<ReaderArticleViewData> {
  const visibleArticleIds = [...new Set(articleIds)].filter(Boolean)
  const selectedId =
    selectedArticleId && visibleArticleIds.includes(selectedArticleId)
      ? selectedArticleId
      : visibleArticleIds[0]
  const isRiver = displayMode === "READER" || defaultView === "RIVER"
  const detailIds = isRiver
    ? [
        ...new Set([
          ...visibleArticleIds.slice(0, RIVER_READER_DETAIL_LIMIT),
          ...(selectedId ? [selectedId] : []),
        ]),
      ]
    : selectedId
      ? [selectedId]
      : []
  const details = await listReaderArticlesByIdsForUser({
    articleIds: detailIds,
    userId,
  })

  return {
    riverArticles: isRiver ? details : [],
    selectedArticle:
      details.find((article) => article.id === selectedId) ?? null,
  }
}

export function readerArticlePageLimit({
  defaultView,
  displayMode,
}: {
  defaultView: string
  displayMode: string
}) {
  return displayMode === "READER" || defaultView === "RIVER"
    ? RIVER_READER_DETAIL_LIMIT
    : DEFAULT_READER_PAGE_LIMIT
}

/**
 * Loads already-authorized article ids with the same relation shape used by
 * every reader surface. Callers that discover ids through another query (such
 * as full-text search) must still pass through this guard: a subscription can
 * be paused or removed between the discovery query and detail hydration.
 */
export async function listReaderArticlesByIdsForUser({
  articleIds,
  userId,
}: {
  articleIds: string[]
  userId: string
}): Promise<ReaderArticle[]> {
  return listReaderArticlesByIdsForUserWithClient({
    articleIds,
    store: getPrisma(),
    userId,
  })
}

/**
 * Hydrates search result ids into reader list metadata while preserving the
 * same subscription and archive authorization guard as the detail loader.
 */
export async function listReaderArticleListItemsByIdsForUser({
  articleIds,
  userId,
}: {
  articleIds: string[]
  userId: string
}): Promise<ReaderArticleListItem[]> {
  return listReaderArticleListItemsByIdsForUserWithClient({
    articleIds,
    store: getPrisma() as unknown as ReaderArticleListItemsStore,
    userId,
  })
}

export async function listReaderArticleListItemsByIdsForUserWithClient({
  articleIds,
  store,
  userId,
}: {
  articleIds: string[]
  store: ReaderArticleListItemsStore
  userId: string
}): Promise<ReaderArticleListItem[]> {
  const uniqueArticleIds = [...new Set(articleIds)].filter(Boolean)

  if (!uniqueArticleIds.length) {
    return []
  }

  const articles = await store.article.findMany({
    select: readerArticleListSelect(userId),
    where: {
      AND: [
        { id: { in: uniqueArticleIds } },
        notArchivedArticleWhere(userId),
        subscribedArticleWhere(userId),
      ],
    },
  })
  const articlesById = new Map(
    articles.map((article) => [article.id, mapReaderArticleListItem(article)])
  )

  return uniqueArticleIds.flatMap((articleId) => {
    const article = articlesById.get(articleId)

    return article ? [article] : []
  })
}

export async function listReaderArticlesByIdsForUserWithClient({
  articleIds,
  store,
  userId,
}: {
  articleIds: string[]
  store: ReaderArticleStore
  userId: string
}): Promise<ReaderArticle[]> {
  const uniqueArticleIds = [...new Set(articleIds)].filter(Boolean)

  if (!uniqueArticleIds.length) {
    return []
  }

  const articles = await store.article.findMany({
    include: readerArticleInclude(userId),
    where: {
      AND: [
        { id: { in: uniqueArticleIds } },
        notArchivedArticleWhere(userId),
        subscribedArticleWhere(userId),
      ],
    },
  })
  const articlesById = new Map(
    articles.map((article) => [article.id, mapReaderArticle(article)])
  )

  return uniqueArticleIds.flatMap((articleId) => {
    const article = articlesById.get(articleId)

    return article ? [article] : []
  })
}

/**
 * Loads only the metadata used by related-coverage presentation while keeping
 * the reader's subscription and archive authorization guard at the query.
 */
export async function listStoryClusterArticlesByIdsForUser({
  articleIds,
  userId,
}: {
  articleIds: string[]
  userId: string
}): Promise<StoryClusterArticleProjection[]> {
  return listStoryClusterArticlesByIdsForUserWithClient({
    articleIds,
    store: getPrisma() as unknown as StoryClusterArticleStore,
    userId,
  })
}

export async function listStoryClusterArticlesByIdsForUserWithClient({
  articleIds,
  store,
  userId,
}: {
  articleIds: string[]
  store: StoryClusterArticleStore
  userId: string
}): Promise<StoryClusterArticleProjection[]> {
  const uniqueArticleIds = [...new Set(articleIds)].filter(Boolean)

  if (!uniqueArticleIds.length) {
    return []
  }

  const articles = await store.article.findMany({
    select: storyClusterArticleSelect(),
    where: {
      AND: [
        { id: { in: uniqueArticleIds } },
        notArchivedArticleWhere(userId),
        subscribedArticleWhere(userId),
      ],
    },
  })
  const articlesById = new Map(
    articles.map((article) => [article.id, mapStoryClusterArticle(article)])
  )

  return uniqueArticleIds.flatMap((articleId) => {
    const article = articlesById.get(articleId)

    return article ? [article] : []
  })
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
    store: getPrisma() as unknown as PublicReaderArticleListStore,
  })
}

export async function listPublicReaderArticlesWithClient({
  limit = 50,
  publicFeedUrls,
  store,
}: {
  limit?: number
  publicFeedUrls: readonly string[]
  store: PublicReaderArticleListStore
}): Promise<ReaderArticleListItem[]> {
  const boundedLimit = pageSize(limit)
  const articles = await store.article.findMany({
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    // A publisher can appear in more than one Discover entry. Fetch a small
    // buffer so deduplication still leaves a useful guest preview.
    select: readerArticleListSelect(PUBLIC_GUEST_PREVIEW_USER_ID),
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
    .map((article) => mapReaderArticleListItem(article))
    .filter((article) => {
      if (seenUrls.has(article.url)) {
        return false
      }

      seenUrls.add(article.url)
      return true
    })
    .slice(0, boundedLimit)
}

export async function getPublicReaderArticle({
  articleId,
}: {
  articleId: string
}): Promise<ReaderArticle | null> {
  const directory = await getDiscoverDirectory()
  const publicFeedUrls = [
    ...new Set(
      directory.feeds.flatMap((feed) => [feed.url, ...(feed.aliases ?? [])])
    ),
  ]
  const article = await getPrisma().article.findFirst({
    include: readerArticleInclude(PUBLIC_GUEST_PREVIEW_USER_ID),
    where: {
      AND: [
        { id: articleId },
        {
          feed: {
            feedUrl: {
              in: publicFeedUrls,
            },
          },
        },
      ],
    },
  })

  return article ? mapReaderArticle(article) : null
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
  articles: ReaderArticleListItem[]
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

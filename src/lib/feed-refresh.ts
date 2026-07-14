import { getPrisma } from "./db"
import { extractReadableArticleContent } from "./article-content-extraction"
import { parseFeedArticles, type ParsedFeedArticle } from "./feed-articles"
import {
  normalizeHttpUrl,
  safeFetchText,
  type SafeFetchTextOptions,
  type SafeFetchTextResult,
} from "./url-safety"
import { nextFetchAt } from "./refresh-schedule"
import { writeRefreshItems, type RefreshWriteStats } from "./refresh-write-batch"

export const MAX_LINKED_ARTICLE_FETCHES = 12
export const MAX_LINKED_ARTICLE_FETCH_CONCURRENCY = 3
export const MAX_REQUESTS_PER_FEED_REFRESH = 1 + MAX_LINKED_ARTICLE_FETCHES

type RefreshableFeed = {
  consecutiveFailures: number
  etag: string | null
  feedUrl: string
  id: string
  lastModified: string | null
  refreshIntervalMinutes: number
}

type FeedRefreshStore = {
  $transaction(operations: Array<Promise<unknown>>): Promise<unknown>
  article: {
    createMany(args: {
      data: Array<Record<string, unknown>>
      skipDuplicates: boolean
    }): Promise<{ count: number }>
    findMany(args: {
      select: { externalId: true; id?: true }
      where: {
        externalId: { in: string[] }
        feedId: string
      }
    }): Promise<Array<{ externalId: string; id?: string }>>
    update(args: {
      data: Record<string, unknown>
      where: {
        feedId_externalId: {
          externalId: string
          feedId: string
        }
      }
    }): Promise<unknown>
  }
  feed: {
    findUnique(args: {
      select: {
        consecutiveFailures: true
        etag: true
        feedUrl: true
        id: true
        lastModified: true
        refreshIntervalMinutes: true
      }
      where: {
        id: string
      }
    }): Promise<RefreshableFeed | null>
    update(args: {
      data: Record<string, unknown>
      where: {
        id: string
      }
    }): Promise<unknown>
  }
}

type RefreshFeedOptions = {
  feedId: string
  fetchArticleContent?: (url: URL) => Promise<SafeFetchTextResult>
  fetchText?: (
    url: URL,
    options?: SafeFetchTextOptions
  ) => Promise<SafeFetchTextResult>
  now?: () => Date
  random?: () => number
  store?: FeedRefreshStore
}

export type RefreshMetrics = RefreshWriteStats & {
  bytes: number
  conditionalHit: boolean
  durationMs: number
  linkedArticleRequestCount: number
  parsedCount: number
  status: number
}

export type RefreshFeedResult = {
  articleCount: number
  feedId: string
  metrics?: RefreshMetrics
  newArticleIds?: string[]
}

export class FeedRefreshError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "FeedRefreshError"
  }
}

export async function refreshFeed(feedId: string) {
  return refreshFeedWithClient({
    feedId,
    store: getFeedRefreshStore(),
  })
}

export async function refreshFeedWithClient({
  feedId,
  fetchArticleContent = safeFetchText,
  fetchText = safeFetchText,
  now = () => new Date(),
  random = Math.random,
  store = getFeedRefreshStore(),
}: RefreshFeedOptions): Promise<RefreshFeedResult> {
  const feed = await store.feed.findUnique({
    select: {
      consecutiveFailures: true,
      etag: true,
      feedUrl: true,
      id: true,
      lastModified: true,
      refreshIntervalMinutes: true,
    },
    where: { id: feedId },
  })

  if (!feed) {
    throw new FeedRefreshError("Feed not found.")
  }

  const fetchedAt = now()
  const startedAt = performance.now()

  try {
    const response = await fetchText(normalizeHttpUrl(feed.feedUrl), {
      allowNotModified: true,
      ifModifiedSince: feed.lastModified ?? undefined,
      ifNoneMatch: feed.etag ?? undefined,
    })
    const baseMetrics = {
      bytes: responseBytes(response),
      conditionalHit: Boolean(response.notModified),
      durationMs: 0,
      linkedArticleRequestCount: 0,
      parsedCount: 0,
      status: response.status ?? 200,
    }

    if (response.notModified) {
      await recordSuccessfulFeedFetch({
        feed,
        fetchedAt,
        random,
        response,
        store,
      })

      return {
        articleCount: 0,
        feedId: feed.id,
        metrics: {
          ...baseMetrics,
          durationMs: elapsedMs(startedAt),
          insertedCount: 0,
          skippedCount: 0,
          updatedCount: 0,
        },
      }
    }

    const parsedArticles = parseFeedArticles(response.text, response.url.href)
    const hydrated = await hydrateLinkedArticleContent({
      articles: parsedArticles,
      feedUrl: feed.feedUrl,
      fetchArticleContent,
      responseUrl: response.url.href,
    })
    const writes = await writeFeedArticles({
      articles: hydrated.articles,
      feedId: feed.id,
      store,
    })

    await recordSuccessfulFeedFetch({
      feed,
      fetchedAt,
      random,
      response,
      store,
    })

    return {
      articleCount: hydrated.articles.length,
      feedId: feed.id,
      metrics: {
        ...baseMetrics,
        bytes: baseMetrics.bytes + hydrated.bytes,
        durationMs: elapsedMs(startedAt),
        linkedArticleRequestCount: hydrated.requestCount,
        parsedCount: parsedArticles.length,
        ...writes,
      },
      ...(writes.newArticleIds.length ? { newArticleIds: writes.newArticleIds } : {}),
    }
  } catch (error) {
    const consecutiveFailures = feed.consecutiveFailures + 1

    await store.feed.update({
      data: {
        consecutiveFailures,
        lastError: errorMessage(error),
        lastFailedAt: fetchedAt,
        lastFetchedAt: fetchedAt,
        nextFetchAt: nextFetchAt({
          consecutiveFailures,
          now: fetchedAt,
          random,
          refreshIntervalMinutes: feed.refreshIntervalMinutes,
        }),
      },
      where: { id: feed.id },
    })

    throw error
  }
}

async function recordSuccessfulFeedFetch({
  feed,
  fetchedAt,
  random,
  response,
  store,
}: {
  feed: RefreshableFeed
  fetchedAt: Date
  random: () => number
  response: SafeFetchTextResult
  store: FeedRefreshStore
}) {
  await store.feed.update({
    data: {
      ...responseValidators(response),
      lastError: null,
      lastFailedAt: null,
      lastFetchedAt: fetchedAt,
      lastSuccessfulFetchAt: fetchedAt,
      consecutiveFailures: 0,
      nextFetchAt: nextFetchAt({
        consecutiveFailures: 0,
        now: fetchedAt,
        random,
        refreshIntervalMinutes: feed.refreshIntervalMinutes,
      }),
    },
    where: { id: feed.id },
  })
}

async function writeFeedArticles({
  articles,
  feedId,
  store,
}: {
  articles: ParsedFeedArticle[]
  feedId: string
  store: FeedRefreshStore
}) {
  const existing = await store.article.findMany({
    select: { externalId: true },
    where: {
      externalId: { in: articles.map((article) => article.externalId) },
      feedId,
    },
  })
  const existingExternalIds = new Set(existing.map((article) => article.externalId))
  const candidateExternalIds = [
    ...new Set(articles.map((article) => article.externalId)),
  ].filter((externalId) => !existingExternalIds.has(externalId))
  const writes = await writeRefreshItems({
    createMany: (items) =>
      store.article.createMany({
        data: items.map((article) => articleCreateData(feedId, article)),
        skipDuplicates: true,
      }),
    findExistingExternalIds: async (externalIds) =>
      externalIds
        .filter((externalId) => existingExternalIds.has(externalId))
        .map((externalId) => ({ externalId })),
    items: articles,
    runUpdateBatch: (operations) => store.$transaction(operations),
    update: (article) =>
      store.article.update({
        data: articleUpdateData(article),
        where: {
          feedId_externalId: {
            externalId: article.externalId,
            feedId,
          },
        },
      }),
  })

  // When a concurrent refresh wins a create race, do not emit a possibly old
  // item as a fresh chat event. Under-posting is safer than bot duplication.
  if (writes.insertedCount !== candidateExternalIds.length || !candidateExternalIds.length) {
    return { ...writes, newArticleIds: [] }
  }

  const inserted = await store.article.findMany({
    select: { externalId: true, id: true },
    where: { externalId: { in: candidateExternalIds }, feedId },
  })
  const newArticleIds = inserted
    .map((article) => article.id)
    .filter((id): id is string => typeof id === "string")

  return {
    ...writes,
    newArticleIds:
      newArticleIds.length === candidateExternalIds.length ? newArticleIds : [],
  }
}

async function hydrateLinkedArticleContent({
  articles,
  feedUrl,
  fetchArticleContent,
  responseUrl,
}: {
  articles: ParsedFeedArticle[]
  feedUrl: string
  fetchArticleContent: (url: URL) => Promise<SafeFetchTextResult>
  responseUrl: string
}) {
  if (!isHackerNewsFeed(feedUrl) && !isHackerNewsFeed(responseUrl)) {
    return {
      articles,
      bytes: 0,
      requestCount: 0,
    }
  }

  const hydratedArticles = [...articles]
  const candidates = articles
    .map((article, index) => ({ article, index }))
    .filter(({ article }) => needsLinkedArticleHydration(article))
    .slice(0, MAX_LINKED_ARTICLE_FETCHES)
  let nextCandidate = 0
  let bytes = 0
  let requestCount = 0

  await Promise.all(
    Array.from(
      { length: Math.min(MAX_LINKED_ARTICLE_FETCH_CONCURRENCY, candidates.length) },
      async () => {
        while (true) {
          const candidate = candidates[nextCandidate]
          nextCandidate += 1

          if (!candidate) {
            return
          }

          requestCount += 1

          try {
            const response = await fetchArticleContent(
              normalizeHttpUrl(candidate.article.url)
            )
            bytes += responseBytes(response)
            const extracted = extractReadableArticleContent(
              response.text,
              response.url.href
            )

            if (!extracted) {
              continue
            }

            hydratedArticles[candidate.index] = {
              ...candidate.article,
              contentHtml: extracted.contentHtml,
              contentText: extracted.contentText,
              imageUrl: candidate.article.imageUrl ?? extracted.imageUrl,
              summary:
                meaningfulSummary(candidate.article.summary) ??
                extracted.summary ??
                excerpt(extracted.contentText),
            }
          } catch {
            // A linked article is optional enrichment. The feed item remains usable.
          }
        }
      }
    )
  )

  return {
    articles: hydratedArticles,
    bytes,
    requestCount,
  }
}

function isHackerNewsFeed(value: string) {
  try {
    return new URL(value).hostname.toLowerCase() === "news.ycombinator.com"
  } catch {
    return false
  }
}

function needsLinkedArticleHydration(article: ParsedFeedArticle) {
  const contentText = article.contentText?.trim()

  return !contentText || contentText.toLowerCase() === "comments"
}

function meaningfulSummary(value: string | undefined) {
  const summary = value?.trim()

  if (!summary || summary.toLowerCase() === "comments") {
    return undefined
  }

  return summary
}

function excerpt(value: string) {
  return value.length <= 240 ? value : `${value.slice(0, 237).trimEnd()}...`
}

function articleCreateData(feedId: string, article: ParsedFeedArticle) {
  return withoutUndefined({
    ...article,
    feedId,
  })
}

function articleUpdateData(article: ParsedFeedArticle) {
  return withoutUndefined({
    author: article.author,
    canonicalUrl: article.canonicalUrl,
    contentHtml: article.contentHtml,
    contentText: article.contentText,
    imageUrl: article.imageUrl,
    publishedAt: article.publishedAt,
    summary: article.summary,
    title: article.title,
    url: article.url,
  })
}

function responseValidators(response: SafeFetchTextResult) {
  return withoutUndefined({
    etag: response.etag,
    lastModified: response.lastModified,
  })
}

function responseBytes(response: SafeFetchTextResult) {
  return response.bytes ?? Buffer.byteLength(response.text)
}

function elapsedMs(startedAt: number) {
  return Math.max(0, Math.round(performance.now() - startedAt))
}

function withoutUndefined(values: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined)
  )
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message.slice(0, 500)
  }

  return "Feed refresh failed."
}

function getFeedRefreshStore() {
  return getPrisma() as unknown as FeedRefreshStore
}

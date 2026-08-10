import { getPrisma } from "./db"
import { parseFeedXml, type ParsedFeedMetadata } from "./feed-discovery"
import { extractReadableArticleContent } from "./article-content-extraction"
import { parseFeedArticlesWithMetrics, type ParsedFeedArticle } from "./feed-articles"
import {
  normalizeHttpUrl,
  safeFetchText,
  type SafeFetchTextOptions,
  type SafeFetchTextResult,
} from "./url-safety"
import { nextFetchAt } from "./refresh-schedule"
import { writeRefreshItems, type RefreshWriteStats } from "./refresh-write-batch"
import { articleIngestionFingerprint } from "./ingestion-fingerprint"
import { externalIdentityHash } from "./external-identity"
import {
  claimSourceRefreshLease,
  releaseSourceRefreshLease,
  renewSourceRefreshLease,
  runWithSourceRefreshLeaseHeartbeat,
  sourceRefreshLeaseWhere,
  type SourceRefreshLease,
  type SourceRefreshLeaseStore,
} from "./source-refresh-leases"

export const MAX_LINKED_ARTICLE_FETCHES = 12
export const MAX_LINKED_ARTICLE_FETCH_CONCURRENCY = 3
export const MAX_REQUESTS_PER_FEED_REFRESH = 1 + MAX_LINKED_ARTICLE_FETCHES

type RefreshableFeed = {
  consecutiveFailures: number
  etag: string | null
  feedUrl: string
  id: string
  lastError: string | null
  lastFeedSelfUrl: string | null
  lastModified: string | null
  lastResolvedFeedUrl: string | null
  refreshGeneration: number
  refreshLeaseExpiresAt: Date | null
  refreshOwner: string | null
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
      select: {
        externalId: true
        id?: true
        ingestionFingerprint?: true
        sourceGeneration?: true
      }
      where: {
        externalId: { in: string[] }
        feedId: string
      }
    }): Promise<Array<{
      externalId: string
      id?: string
      ingestionFingerprint?: string | null
      sourceGeneration?: number | null
    }>>
    updateMany(args: {
      data: Record<string, unknown>
      where: Record<string, unknown>
    }): Promise<{ count: number }>
  }
  feed: {
    findUnique(args: {
      select: {
        consecutiveFailures: true
        etag: true
        feedUrl: true
        id: true
        lastError: true
        lastFeedSelfUrl: true
        lastModified: true
        lastResolvedFeedUrl: true
        refreshGeneration: true
        refreshLeaseExpiresAt: true
        refreshOwner: true
        refreshIntervalMinutes: true
      }
      where: {
        id: string
      }
    }): Promise<RefreshableFeed | null>
    updateMany(args: {
      data: Record<string, unknown>
      where: Record<string, unknown>
    }): Promise<{ count: number }>
  }
}

type RefreshFeedOptions = {
  feedId: string
  fetchArticleContent?: (url: URL) => Promise<SafeFetchTextResult>
  fetchText?: (
    url: URL,
    options?: SafeFetchTextOptions
  ) => Promise<SafeFetchTextResult>
  leaseDurationMs?: number
  leaseOwner?: string
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
  sourceParseContentBytes?: number
  sourceParseFieldsTruncated?: number
  sourceParseItemsAccepted?: number
  sourceParseItemsTruncated?: number
  status: number
}

export type RefreshFeedResult = {
  articleCount: number
  feedId: string
  metrics?: RefreshMetrics
  newArticleIds?: string[]
  skipped?: true
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
  leaseDurationMs,
  leaseOwner,
  now = () => new Date(),
  random = Math.random,
  store = getFeedRefreshStore(),
}: RefreshFeedOptions): Promise<RefreshFeedResult> {
  const lease = await claimSourceRefreshLease({
    ...(leaseDurationMs === undefined ? {} : { leaseDurationMs }),
    ...(leaseOwner === undefined ? {} : { owner: leaseOwner }),
    now: now(),
    sourceId: feedId,
    store: feedRefreshLeaseStore(store, feedId),
  })

  if (!lease) {
    const source = await store.feed.findUnique({
      select: {
        consecutiveFailures: true,
        etag: true,
        feedUrl: true,
        id: true,
        lastError: true,
        lastFeedSelfUrl: true,
        lastModified: true,
        lastResolvedFeedUrl: true,
        refreshGeneration: true,
        refreshLeaseExpiresAt: true,
        refreshOwner: true,
        refreshIntervalMinutes: true,
      },
      where: { id: feedId },
    })
    if (!source) {
      throw new FeedRefreshError("Feed not found.")
    }

    return { articleCount: 0, feedId, skipped: true }
  }

  const feed = await store.feed.findUnique({
    select: {
      consecutiveFailures: true,
      etag: true,
      feedUrl: true,
      id: true,
      lastError: true,
      lastFeedSelfUrl: true,
      lastModified: true,
      lastResolvedFeedUrl: true,
      refreshGeneration: true,
      refreshLeaseExpiresAt: true,
      refreshOwner: true,
      refreshIntervalMinutes: true,
    },
    where: { id: feedId },
  })

  if (!feed) {
    await releaseSourceRefreshLease({
      lease,
      now: now(),
      store: feedRefreshLeaseStore(store, feedId),
    })
    throw new FeedRefreshError("Feed not found.")
  }

  const fetchedAt = now()
  const startedAt = performance.now()

  try {
    const fetched = await runWithSourceRefreshLeaseHeartbeat({
      lease,
      now,
      store: feedRefreshLeaseStore(store, feed.id),
      work: () =>
        fetchText(normalizeHttpUrl(feed.feedUrl), {
          allowNotModified: true,
          ifModifiedSince: feed.lastModified ?? undefined,
          ifNoneMatch: feed.etag ?? undefined,
        }),
    })
    ensureLeaseHeld(fetched.leaseHeld)
    const response = fetched.result
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
        lease,
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
          changedCount: 0,
          duplicateInputCount: 0,
          insertedCount: 0,
          unchangedCount: 0,
        },
      }
    }

    const parsed = parseFeedArticlesWithMetrics(response.text, response.url.href)
    const metadata = safeFeedMetadata(response.text, response.url.href)
    recordFeedParseMetrics(feed.id, parsed.stats)
    const hydration = await runWithSourceRefreshLeaseHeartbeat({
      lease,
      now,
      store: feedRefreshLeaseStore(store, feed.id),
      work: () =>
        hydrateLinkedArticleContent({
          articles: parsed.articles,
          feedUrl: feed.feedUrl,
          fetchArticleContent,
          responseUrl: response.url.href,
        }),
    })
    ensureLeaseHeld(hydration.leaseHeld)
    const hydrated = hydration.result
    await renewOrThrow({ lease, now, store: feedRefreshLeaseStore(store, feed.id) })
    const writes = await writeFeedArticles({
      articles: hydrated.articles,
      beforeWriteBatch: () =>
        renewOrThrow({
          lease,
          now,
          store: feedRefreshLeaseStore(store, feed.id),
        }),
      feedId: feed.id,
      sourceGeneration: lease.generation,
      store,
    })

    await recordSuccessfulFeedFetch({
      feed,
      fetchedAt,
      lease,
      metadata,
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
        parsedCount: parsed.stats.parsedCount,
        sourceParseContentBytes: parsed.stats.contentBytes,
        sourceParseFieldsTruncated: parsed.stats.fieldsTruncated,
        sourceParseItemsAccepted: parsed.stats.acceptedCount,
        sourceParseItemsTruncated: parsed.stats.truncatedCount,
        ...writes,
      },
      ...(writes.newArticleIds.length ? { newArticleIds: writes.newArticleIds } : {}),
    }
  } catch (error) {
    if (error instanceof SourceRefreshLeaseLostError) {
      return { articleCount: 0, feedId: feed.id, skipped: true }
    }

    const consecutiveFailures = feed.consecutiveFailures + 1

    await store.feed.updateMany({
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
      where: sourceRefreshLeaseWhere(lease, now()),
    })

    throw error
  } finally {
    await releaseSourceRefreshLease({
      lease,
      now: now(),
      store: feedRefreshLeaseStore(store, feed.id),
    })
  }
}

function recordFeedParseMetrics(
  sourceId: string,
  {
    acceptedCount,
    contentBytes,
    fieldsTruncated,
    parsedCount,
    publicationDateDiagnostics,
    truncatedCount,
  }: {
    acceptedCount: number
    contentBytes: number
    fieldsTruncated: number
    parsedCount: number
    publicationDateDiagnostics: {
      "future-skew": number
      invalid: number
      "out-of-range": number
    }
    truncatedCount: number
  }
) {
  console.info(
    JSON.stringify({
      event: "source_parse_metrics",
      sourceId,
      sourceKind: "feed",
      source_parse_content_bytes: contentBytes,
      source_parse_fields_truncated: fieldsTruncated,
      source_parse_items_accepted: acceptedCount,
      source_parse_items_total: parsedCount,
      source_parse_items_truncated: truncatedCount,
      source_parse_publication_dates_future_skew: publicationDateDiagnostics["future-skew"],
      source_parse_publication_dates_invalid: publicationDateDiagnostics.invalid,
      source_parse_publication_dates_out_of_range: publicationDateDiagnostics["out-of-range"],
    })
  )
}

async function recordSuccessfulFeedFetch({
  feed,
  fetchedAt,
  lease,
  metadata,
  random,
  response,
  store,
}: {
  feed: RefreshableFeed
  fetchedAt: Date
  lease: SourceRefreshLease
  metadata?: ParsedFeedMetadata
  random: () => number
  response: SafeFetchTextResult
  store: FeedRefreshStore
}) {
  const updated = await store.feed.updateMany({
    data: {
      ...responseValidators(response),
      ...feedUrlObservation({ feed, fetchedAt, metadata, response }),
      lastError: null,
      lastFailedAt: null,
      lastFetchedAt: fetchedAt,
      lastSuccessfulFetchAt: fetchedAt,
      ...(feed.lastError ? { lastRecoveredAt: fetchedAt } : {}),
      consecutiveFailures: 0,
      nextFetchAt: nextFetchAt({
        consecutiveFailures: 0,
        now: fetchedAt,
        random,
        refreshIntervalMinutes: feed.refreshIntervalMinutes,
      }),
    },
    where: sourceRefreshLeaseWhere(lease),
  })

  ensureLeaseHeld(updated.count === 1)
}

async function writeFeedArticles({
  articles,
  beforeWriteBatch,
  feedId,
  sourceGeneration,
  store,
}: {
  articles: ParsedFeedArticle[]
  beforeWriteBatch: () => Promise<void>
  feedId: string
  sourceGeneration: number
  store: FeedRefreshStore
}) {
  const existing = await store.article.findMany({
    select: { externalId: true, ingestionFingerprint: true, sourceGeneration: true },
    where: {
      externalId: { in: articles.map((article) => article.externalId) },
      feedId,
    },
  })
  const existingByExternalId = new Map(
    existing.map((article) => [article.externalId, article])
  )
  const existingExternalIds = new Set(existingByExternalId.keys())
  const candidateExternalIds = [
    ...new Set(articles.map((article) => article.externalId)),
  ].filter((externalId) => !existingExternalIds.has(externalId))
  const writes = await writeRefreshItems({
    beforeWriteBatch,
    createMany: (items) =>
      store.article.createMany({
        data: items.map((article) => articleCreateData(feedId, article)),
        skipDuplicates: true,
      }),
    findExistingItems: async (externalIds) =>
      externalIds
        .filter((externalId) => existingExternalIds.has(externalId))
        .map((externalId) => {
          return {
            externalId,
            ingestionFingerprint:
              existingByExternalId.get(externalId)?.ingestionFingerprint ?? null,
            sourceGeneration:
              existingByExternalId.get(externalId)?.sourceGeneration ?? null,
          }
        }),
    items: articles.map((article) => ({
      ...article,
      externalIdHash: externalIdentityHash(article.externalId),
      ingestionFingerprint: articleIngestionFingerprint(article),
      sourceGeneration,
    })),
    runUpdateBatch: (operations) => store.$transaction(operations),
    shouldUpdateExisting: (existing, article) =>
      existing.sourceGeneration === null ||
      existing.sourceGeneration === undefined ||
      existing.sourceGeneration < article.sourceGeneration,
    update: (article) =>
      store.article.updateMany({
        data: articleUpdateData(article),
        where: {
          externalId: article.externalId,
          feedId,
          OR: [
            { sourceGeneration: null },
            { sourceGeneration: { lt: article.sourceGeneration } },
          ],
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
              canonicalUrl: extracted.canonicalUrl ?? response.url.href,
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

function articleCreateData(
  feedId: string,
  article: ParsedFeedArticle & {
    externalIdHash: string
    ingestionFingerprint: string
    sourceGeneration: number
  },
) {
  return withoutUndefined({
    ...article,
    feedId,
  })
}

function articleUpdateData(
  article: ParsedFeedArticle & {
    externalIdHash: string
    ingestionFingerprint: string
    sourceGeneration: number
  },
) {
  return {
    author: article.author ?? null,
    canonicalUrl: article.canonicalUrl ?? null,
    contentHtml: article.contentHtml ?? null,
    contentText: article.contentText ?? null,
    externalIdHash: article.externalIdHash,
    imageUrl: article.imageUrl ?? null,
    ingestionFingerprint: article.ingestionFingerprint,
    publishedAt: article.publishedAt ?? null,
    sourceGeneration: article.sourceGeneration,
    summary: article.summary ?? null,
    title: article.title,
    url: article.url,
  }
}

function safeFeedMetadata(xml: string, feedUrl: string) {
  try {
    return parseFeedXml(xml, feedUrl)
  } catch {
    // Article ingestion already validated the source. Metadata is optional
    // hygiene evidence and must not turn a successful refresh into a failure.
    return undefined
  }
}

function feedUrlObservation({
  feed,
  fetchedAt,
  metadata,
  response,
}: {
  feed: RefreshableFeed
  fetchedAt: Date
  metadata?: ParsedFeedMetadata
  response: SafeFetchTextResult
}) {
  const resolvedFeedUrl = response.url.href
  const permanentRedirect = response.redirects
    ?.filter((redirect) => redirect.status === 301 || redirect.status === 308)
    .at(-1)?.to
  const observation: Record<string, unknown> = {
    lastPermanentRedirectUrl: permanentRedirect ?? null,
    lastResolvedFeedUrl: resolvedFeedUrl,
    lastSourceUrlObservedAt: fetchedAt,
  }

  if (feed.lastResolvedFeedUrl && feed.lastResolvedFeedUrl !== resolvedFeedUrl) {
    observation.previousResolvedFeedUrl = feed.lastResolvedFeedUrl
  }

  if (metadata) {
    observation.lastFeedSelfUrl = metadata.feedSelfUrl ?? null

    if (
      feed.lastFeedSelfUrl &&
      feed.lastFeedSelfUrl !== (metadata.feedSelfUrl ?? null)
    ) {
      observation.previousFeedSelfUrl = feed.lastFeedSelfUrl
    }
  }

  return observation
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

class SourceRefreshLeaseLostError extends Error {
  constructor() {
    super("Source refresh lease was lost.")
    this.name = "SourceRefreshLeaseLostError"
  }
}

function ensureLeaseHeld(leaseHeld: boolean) {
  if (!leaseHeld) {
    throw new SourceRefreshLeaseLostError()
  }
}

async function renewOrThrow({
  lease,
  now,
  store,
}: {
  lease: SourceRefreshLease
  now: () => Date
  store: SourceRefreshLeaseStore
}) {
  ensureLeaseHeld(await renewSourceRefreshLease({ lease, now: now(), store }))
}

function feedRefreshLeaseStore(
  store: FeedRefreshStore,
  feedId: string,
): SourceRefreshLeaseStore {
  return {
    findCurrent: () =>
      store.feed.findUnique({
        select: {
          consecutiveFailures: true,
          etag: true,
          feedUrl: true,
          id: true,
          lastError: true,
          lastFeedSelfUrl: true,
          lastModified: true,
          lastResolvedFeedUrl: true,
          refreshGeneration: true,
          refreshLeaseExpiresAt: true,
          refreshOwner: true,
          refreshIntervalMinutes: true,
        },
        where: { id: feedId },
      }),
    updateMany: (args) => store.feed.updateMany(args),
  }
}

function getFeedRefreshStore() {
  return getPrisma() as unknown as FeedRefreshStore
}

import { getPrisma } from "./db"
import { fetchPodcastFeedText } from "./podcast-fetch"
import { parsePodcastFeedWithMetrics, type ParsedPodcastEpisode } from "./podcast-parser"
import {
  normalizeHttpUrl,
  type SafeFetchTextOptions,
  type SafeFetchTextResult,
} from "./url-safety"
import { nextFetchAt } from "./refresh-schedule"
import { writeRefreshItems, type RefreshWriteStats } from "./refresh-write-batch"
import { podcastEpisodeIngestionFingerprint } from "./ingestion-fingerprint"
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

type RefreshablePodcast = {
  consecutiveFailures: number
  etag: string | null
  feedUrl: string
  id: string
  lastModified: string | null
  refreshGeneration: number
  refreshLeaseExpiresAt: Date | null
  refreshOwner: string | null
  refreshIntervalMinutes: number
}

type PodcastRefreshStore = {
  $transaction(operations: Array<Promise<unknown>>): Promise<unknown>
  podcast: {
    findUnique(args: {
      select: {
        consecutiveFailures: true
        etag: true
        feedUrl: true
        id: true
        lastModified: true
        refreshGeneration: true
        refreshLeaseExpiresAt: true
        refreshOwner: true
        refreshIntervalMinutes: true
      }
      where: {
        id: string
      }
    }): Promise<RefreshablePodcast | null>
    updateMany(args: {
      data: Record<string, unknown>
      where: Record<string, unknown>
    }): Promise<{ count: number }>
  }
  podcastEpisode: {
    createMany(args: {
      data: Array<Record<string, unknown>>
      skipDuplicates: boolean
    }): Promise<{ count: number }>
    findMany(args: {
      select: { externalId: true; ingestionFingerprint: true; sourceGeneration?: true }
      where: {
        externalId: { in: string[] }
        podcastId: string
      }
    }): Promise<
      Array<{
        externalId: string
        ingestionFingerprint: string | null
        sourceGeneration?: number | null
      }>
    >
    updateMany(args: {
      data: Record<string, unknown>
      where: Record<string, unknown>
    }): Promise<{ count: number }>
  }
}

type RefreshPodcastOptions = {
  fetchText?: (
    url: URL,
    options?: SafeFetchTextOptions
  ) => Promise<SafeFetchTextResult>
  leaseDurationMs?: number
  leaseOwner?: string
  now?: () => Date
  podcastId: string
  random?: () => number
  store?: PodcastRefreshStore
}

export type PodcastRefreshMetrics = RefreshWriteStats & {
  bytes: number
  conditionalHit: boolean
  durationMs: number
  parsedCount: number
  sourceParseContentBytes?: number
  sourceParseFieldsTruncated?: number
  sourceParseItemsAccepted?: number
  sourceParseItemsTruncated?: number
  status: number
}

export type PodcastRefreshResult = {
  episodeCount: number
  metrics?: PodcastRefreshMetrics
  podcastId: string
  skipped?: true
}

export class PodcastRefreshError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PodcastRefreshError"
  }
}

export async function refreshPodcast(podcastId: string) {
  return refreshPodcastWithClient({
    podcastId,
    store: getPodcastRefreshStore(),
  })
}

export async function refreshPodcastWithClient({
  fetchText = fetchPodcastFeedText,
  leaseDurationMs,
  leaseOwner,
  now = () => new Date(),
  podcastId,
  random = Math.random,
  store = getPodcastRefreshStore(),
}: RefreshPodcastOptions): Promise<PodcastRefreshResult> {
  const lease = await claimSourceRefreshLease({
    ...(leaseDurationMs === undefined ? {} : { leaseDurationMs }),
    ...(leaseOwner === undefined ? {} : { owner: leaseOwner }),
    now: now(),
    sourceId: podcastId,
    store: podcastRefreshLeaseStore(store, podcastId),
  })

  if (!lease) {
    const source = await store.podcast.findUnique({
      select: {
        consecutiveFailures: true,
        etag: true,
        feedUrl: true,
        id: true,
        lastModified: true,
        refreshGeneration: true,
        refreshLeaseExpiresAt: true,
        refreshOwner: true,
        refreshIntervalMinutes: true,
      },
      where: { id: podcastId },
    })
    if (!source) {
      throw new PodcastRefreshError("Podcast not found.")
    }

    return { episodeCount: 0, podcastId, skipped: true }
  }

  const podcast = await store.podcast.findUnique({
    select: {
      consecutiveFailures: true,
      etag: true,
      feedUrl: true,
      id: true,
      lastModified: true,
      refreshGeneration: true,
      refreshLeaseExpiresAt: true,
      refreshOwner: true,
      refreshIntervalMinutes: true,
    },
    where: { id: podcastId },
  })

  if (!podcast) {
    await releaseSourceRefreshLease({
      lease,
      now: now(),
      store: podcastRefreshLeaseStore(store, podcastId),
    })
    throw new PodcastRefreshError("Podcast not found.")
  }

  const fetchedAt = now()
  const startedAt = performance.now()

  try {
    const fetched = await runWithSourceRefreshLeaseHeartbeat({
      lease,
      now,
      store: podcastRefreshLeaseStore(store, podcast.id),
      work: () =>
        fetchText(normalizeHttpUrl(podcast.feedUrl), {
          allowNotModified: true,
          ifModifiedSince: podcast.lastModified ?? undefined,
          ifNoneMatch: podcast.etag ?? undefined,
        }),
    })
    ensureLeaseHeld(fetched.leaseHeld)
    const response = fetched.result
    const baseMetrics = {
      bytes: responseBytes(response),
      conditionalHit: Boolean(response.notModified),
      durationMs: 0,
      parsedCount: 0,
      status: response.status ?? 200,
    }

    if (response.notModified) {
      await recordSuccessfulPodcastFetch({
        fetchedAt,
        lease,
        podcast,
        random,
        response,
        store,
      })

      return {
        episodeCount: 0,
        metrics: {
          ...baseMetrics,
          durationMs: elapsedMs(startedAt),
          changedCount: 0,
          duplicateInputCount: 0,
          insertedCount: 0,
          unchangedCount: 0,
        },
        podcastId: podcast.id,
      }
    }

    const parsed = parsePodcastFeedWithMetrics(response.text, response.url.href)
    const parsedPodcast = parsed.podcast
    recordPodcastParseMetrics(podcast.id, parsed.stats)
    const writes = await writePodcastEpisodes({
      beforeWriteBatch: () =>
        renewOrThrow({
          lease,
          now,
          store: podcastRefreshLeaseStore(store, podcast.id),
        }),
      episodes: parsedPodcast.episodes,
      podcastId: podcast.id,
      sourceGeneration: lease.generation,
      store,
    })

    await recordSuccessfulPodcastFetch({
      fetchedAt,
      metadata: {
        artworkUrl: parsedPodcast.artworkUrl,
        author: parsedPodcast.author,
        description: parsedPodcast.description,
        language: parsedPodcast.language,
        siteUrl: parsedPodcast.siteUrl,
        title: parsedPodcast.title,
      },
      podcast,
      random,
      response,
      store,
      lease,
    })

    return {
      episodeCount: parsedPodcast.episodes.length,
      metrics: {
        ...baseMetrics,
        durationMs: elapsedMs(startedAt),
        parsedCount: parsed.stats.parsedCount,
        sourceParseContentBytes: parsed.stats.contentBytes,
        sourceParseFieldsTruncated: parsed.stats.fieldsTruncated,
        sourceParseItemsAccepted: parsed.stats.acceptedCount,
        sourceParseItemsTruncated: parsed.stats.truncatedCount,
        ...writes,
      },
      podcastId: podcast.id,
    }
  } catch (error) {
    if (error instanceof SourceRefreshLeaseLostError) {
      return { episodeCount: 0, podcastId: podcast.id, skipped: true }
    }

    const consecutiveFailures = podcast.consecutiveFailures + 1

    await store.podcast.updateMany({
      data: {
        consecutiveFailures,
        lastError: errorMessage(error),
        lastFailedAt: fetchedAt,
        lastFetchedAt: fetchedAt,
        nextFetchAt: nextFetchAt({
          consecutiveFailures,
          now: fetchedAt,
          random,
          refreshIntervalMinutes: podcast.refreshIntervalMinutes,
        }),
      },
      where: sourceRefreshLeaseWhere(lease, now()),
    })

    throw error
  } finally {
    await releaseSourceRefreshLease({
      lease,
      now: now(),
      store: podcastRefreshLeaseStore(store, podcast.id),
    })
  }
}

function recordPodcastParseMetrics(
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
      sourceKind: "podcast",
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

async function recordSuccessfulPodcastFetch({
  fetchedAt,
  lease,
  metadata,
  podcast,
  random,
  response,
  store,
}: {
  fetchedAt: Date
  lease: SourceRefreshLease
  metadata?: Record<string, unknown>
  podcast: RefreshablePodcast
  random: () => number
  response: SafeFetchTextResult
  store: PodcastRefreshStore
}) {
  const updated = await store.podcast.updateMany({
    data: withoutUndefined({
      ...metadata,
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
        refreshIntervalMinutes: podcast.refreshIntervalMinutes,
      }),
    }),
    where: sourceRefreshLeaseWhere(lease),
  })

  ensureLeaseHeld(updated.count === 1)
}

async function writePodcastEpisodes({
  beforeWriteBatch,
  episodes,
  podcastId,
  sourceGeneration,
  store,
}: {
  beforeWriteBatch: () => Promise<void>
  episodes: ParsedPodcastEpisode[]
  podcastId: string
  sourceGeneration: number
  store: PodcastRefreshStore
}) {
  return writeRefreshItems({
    beforeWriteBatch,
    createMany: (items) =>
      store.podcastEpisode.createMany({
        data: items.map((episode) => episodeCreateData(podcastId, episode)),
        skipDuplicates: true,
      }),
    findExistingItems: (externalIds) =>
      store.podcastEpisode.findMany({
        select: { externalId: true, ingestionFingerprint: true, sourceGeneration: true },
        where: {
          externalId: { in: externalIds },
          podcastId,
        },
      }),
    items: episodes.map((episode) => ({
      ...episode,
      externalIdHash: externalIdentityHash(episode.externalId),
      ingestionFingerprint: podcastEpisodeIngestionFingerprint(episode),
      sourceGeneration,
    })),
    runUpdateBatch: (operations) => store.$transaction(operations),
    shouldUpdateExisting: (existing, episode) =>
      existing.sourceGeneration === null ||
      existing.sourceGeneration === undefined ||
      existing.sourceGeneration < episode.sourceGeneration,
    update: (episode) =>
      store.podcastEpisode.updateMany({
        data: episodeUpdateData(episode),
        where: {
          externalId: episode.externalId,
          podcastId,
          OR: [
            { sourceGeneration: null },
            { sourceGeneration: { lt: episode.sourceGeneration } },
          ],
        },
      }),
  })
}

function episodeCreateData(
  podcastId: string,
  episode: ParsedPodcastEpisode & {
    externalIdHash: string
    ingestionFingerprint: string
    sourceGeneration: number
  },
) {
  return withoutUndefined({
    ...episode,
    podcastId,
  })
}

function episodeUpdateData(
  episode: ParsedPodcastEpisode & {
    externalIdHash: string
    ingestionFingerprint: string
    sourceGeneration: number
  },
) {
  return {
    audioLengthBytes: episode.audioLengthBytes ?? null,
    audioType: episode.audioType ?? null,
    audioUrl: episode.audioUrl,
    contentHtml: episode.contentHtml ?? null,
    contentText: episode.contentText ?? null,
    description: episode.description ?? null,
    durationSeconds: episode.durationSeconds ?? null,
    externalIdHash: episode.externalIdHash,
    imageUrl: episode.imageUrl ?? null,
    ingestionFingerprint: episode.ingestionFingerprint,
    publishedAt: episode.publishedAt ?? null,
    sourceGeneration: episode.sourceGeneration,
    title: episode.title,
    transcriptLanguage: episode.transcriptLanguage ?? null,
    transcriptRel: episode.transcriptRel ?? null,
    transcriptType: episode.transcriptType ?? null,
    transcriptUrl: episode.transcriptUrl ?? null,
    url: episode.url ?? null,
  }
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

  return "Podcast refresh failed."
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

function podcastRefreshLeaseStore(
  store: PodcastRefreshStore,
  podcastId: string,
): SourceRefreshLeaseStore {
  return {
    findCurrent: () =>
      store.podcast.findUnique({
        select: {
          consecutiveFailures: true,
          etag: true,
          feedUrl: true,
          id: true,
          lastModified: true,
          refreshGeneration: true,
          refreshLeaseExpiresAt: true,
          refreshOwner: true,
          refreshIntervalMinutes: true,
        },
        where: { id: podcastId },
      }),
    updateMany: (args) => store.podcast.updateMany(args),
  }
}

function getPodcastRefreshStore() {
  return getPrisma() as unknown as PodcastRefreshStore
}

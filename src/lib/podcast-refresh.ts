import { getPrisma } from "./db"
import { fetchPodcastFeedText } from "./podcast-fetch"
import { parsePodcastFeed, type ParsedPodcastEpisode } from "./podcast-parser"
import {
  normalizeHttpUrl,
  type SafeFetchTextOptions,
  type SafeFetchTextResult,
} from "./url-safety"
import { nextFetchAt } from "./refresh-schedule"
import { writeRefreshItems, type RefreshWriteStats } from "./refresh-write-batch"

type RefreshablePodcast = {
  consecutiveFailures: number
  etag: string | null
  feedUrl: string
  id: string
  lastModified: string | null
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
        refreshIntervalMinutes: true
      }
      where: {
        id: string
      }
    }): Promise<RefreshablePodcast | null>
    update(args: {
      data: Record<string, unknown>
      where: {
        id: string
      }
    }): Promise<unknown>
  }
  podcastEpisode: {
    createMany(args: {
      data: Array<Record<string, unknown>>
      skipDuplicates: boolean
    }): Promise<{ count: number }>
    findMany(args: {
      select: { externalId: true }
      where: {
        externalId: { in: string[] }
        podcastId: string
      }
    }): Promise<Array<{ externalId: string }>>
    update(args: {
      data: Record<string, unknown>
      where: {
        podcastId_externalId: {
          externalId: string
          podcastId: string
        }
      }
    }): Promise<unknown>
  }
}

type RefreshPodcastOptions = {
  fetchText?: (
    url: URL,
    options?: SafeFetchTextOptions
  ) => Promise<SafeFetchTextResult>
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
  status: number
}

export type PodcastRefreshResult = {
  episodeCount: number
  metrics?: PodcastRefreshMetrics
  podcastId: string
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
  now = () => new Date(),
  podcastId,
  random = Math.random,
  store = getPodcastRefreshStore(),
}: RefreshPodcastOptions): Promise<PodcastRefreshResult> {
  const podcast = await store.podcast.findUnique({
    select: {
      consecutiveFailures: true,
      etag: true,
      feedUrl: true,
      id: true,
      lastModified: true,
      refreshIntervalMinutes: true,
    },
    where: { id: podcastId },
  })

  if (!podcast) {
    throw new PodcastRefreshError("Podcast not found.")
  }

  const fetchedAt = now()
  const startedAt = performance.now()

  try {
    const response = await fetchText(normalizeHttpUrl(podcast.feedUrl), {
      allowNotModified: true,
      ifModifiedSince: podcast.lastModified ?? undefined,
      ifNoneMatch: podcast.etag ?? undefined,
    })
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
          insertedCount: 0,
          skippedCount: 0,
          updatedCount: 0,
        },
        podcastId: podcast.id,
      }
    }

    const parsedPodcast = parsePodcastFeed(response.text, response.url.href)
    const writes = await writePodcastEpisodes({
      episodes: parsedPodcast.episodes,
      podcastId: podcast.id,
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
    })

    return {
      episodeCount: parsedPodcast.episodes.length,
      metrics: {
        ...baseMetrics,
        durationMs: elapsedMs(startedAt),
        parsedCount: parsedPodcast.episodes.length,
        ...writes,
      },
      podcastId: podcast.id,
    }
  } catch (error) {
    const consecutiveFailures = podcast.consecutiveFailures + 1

    await store.podcast.update({
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
      where: { id: podcast.id },
    })

    throw error
  }
}

async function recordSuccessfulPodcastFetch({
  fetchedAt,
  metadata,
  podcast,
  random,
  response,
  store,
}: {
  fetchedAt: Date
  metadata?: Record<string, unknown>
  podcast: RefreshablePodcast
  random: () => number
  response: SafeFetchTextResult
  store: PodcastRefreshStore
}) {
  await store.podcast.update({
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
    where: { id: podcast.id },
  })
}

async function writePodcastEpisodes({
  episodes,
  podcastId,
  store,
}: {
  episodes: ParsedPodcastEpisode[]
  podcastId: string
  store: PodcastRefreshStore
}) {
  return writeRefreshItems({
    createMany: (items) =>
      store.podcastEpisode.createMany({
        data: items.map((episode) => episodeCreateData(podcastId, episode)),
        skipDuplicates: true,
      }),
    findExistingExternalIds: (externalIds) =>
      store.podcastEpisode.findMany({
        select: { externalId: true },
        where: {
          externalId: { in: externalIds },
          podcastId,
        },
      }),
    items: episodes,
    runUpdateBatch: (operations) => store.$transaction(operations),
    update: (episode) =>
      store.podcastEpisode.update({
        data: episodeUpdateData(episode),
        where: {
          podcastId_externalId: {
            externalId: episode.externalId,
            podcastId,
          },
        },
      }),
  })
}

function episodeCreateData(podcastId: string, episode: ParsedPodcastEpisode) {
  return withoutUndefined({
    ...episode,
    podcastId,
  })
}

function episodeUpdateData(episode: ParsedPodcastEpisode) {
  return withoutUndefined({
    audioLengthBytes: episode.audioLengthBytes,
    audioType: episode.audioType,
    audioUrl: episode.audioUrl,
    contentHtml: episode.contentHtml,
    contentText: episode.contentText,
    description: episode.description,
    durationSeconds: episode.durationSeconds,
    imageUrl: episode.imageUrl,
    publishedAt: episode.publishedAt,
    title: episode.title,
    url: episode.url,
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

  return "Podcast refresh failed."
}

function getPodcastRefreshStore() {
  return getPrisma() as unknown as PodcastRefreshStore
}

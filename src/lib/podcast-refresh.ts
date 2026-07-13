import { getPrisma } from "./db"
import { fetchPodcastFeedText } from "./podcast-fetch"
import { parsePodcastFeed, type ParsedPodcastEpisode } from "./podcast-parser"
import {
  normalizeHttpUrl,
  type SafeFetchTextResult,
} from "./url-safety"
import { nextFetchAt } from "./refresh-schedule"

type RefreshablePodcast = {
  consecutiveFailures: number
  feedUrl: string
  id: string
  refreshIntervalMinutes: number
}

type PodcastRefreshStore = {
  podcast: {
    findUnique(args: {
      select: {
        consecutiveFailures: true
        feedUrl: true
        id: true
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
    upsert(args: {
      create: Record<string, unknown>
      update: Record<string, unknown>
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
  fetchText?: (url: URL) => Promise<SafeFetchTextResult>
  now?: () => Date
  podcastId: string
  random?: () => number
  store?: PodcastRefreshStore
}

export type PodcastRefreshResult = {
  episodeCount: number
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
      feedUrl: true,
      id: true,
      refreshIntervalMinutes: true,
    },
    where: { id: podcastId },
  })

  if (!podcast) {
    throw new PodcastRefreshError("Podcast not found.")
  }

  const fetchedAt = now()

  try {
    const response = await fetchText(normalizeHttpUrl(podcast.feedUrl))
    const parsedPodcast = parsePodcastFeed(response.text, response.url.href)

    for (const episode of parsedPodcast.episodes) {
      await store.podcastEpisode.upsert(episodeUpsertArgs(podcast.id, episode))
    }

    await store.podcast.update({
      data: withoutUndefined({
        artworkUrl: parsedPodcast.artworkUrl,
        author: parsedPodcast.author,
        description: parsedPodcast.description,
        language: parsedPodcast.language,
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
        siteUrl: parsedPodcast.siteUrl,
        title: parsedPodcast.title,
      }),
      where: { id: podcast.id },
    })

    return {
      episodeCount: parsedPodcast.episodes.length,
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

function episodeUpsertArgs(podcastId: string, episode: ParsedPodcastEpisode) {
  return {
    create: withoutUndefined({
      ...episode,
      podcastId,
    }),
    update: withoutUndefined({
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
    }),
    where: {
      podcastId_externalId: {
        externalId: episode.externalId,
        podcastId,
      },
    },
  }
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

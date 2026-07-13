import { Prisma } from "../generated/prisma/client"

import { getPrisma } from "./db"
import {
  afterTimeCursorWhere,
  decodeTimeCursor,
  encodeTimeCursor,
  pageSize,
} from "./time-cursor"

export type PodcastHomeEpisode = ReturnType<typeof mapEpisode>

export type PodcastHomeSubscription = {
  artworkUrl: string | null
  id: string
  lastError: string | null
  latestEpisodeTitle: string | null
  subscriptionId: string
  title: string
  unplayedCount: number
}

export type PodcastHome = {
  episodes: PodcastHomeEpisode[]
  nextEpisodeCursor: string | null
  subscriptions: PodcastHomeSubscription[]
}

export async function listCollectionPodcastEpisodesForUser({
  collectionId,
  limit = 50,
  userId,
}: {
  collectionId: string
  limit?: number
  userId: string
}): Promise<PodcastHomeEpisode[]> {
  const episodes = await getPrisma().podcastEpisode.findMany({
    include: {
      podcast: true,
      states: {
        take: 1,
        where: { userId },
      },
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
    where: {
      collectionItems: {
        some: {
          collection: {
            userId,
          },
          collectionId,
        },
      },
    },
  })

  return episodes.map(mapEpisode)
}

export async function getPodcastHomeForUser(
  userId: string,
  {
    after,
    limit = 50,
  }: {
    after?: string
    limit?: number
  } = {}
): Promise<PodcastHome> {
  const prisma = getPrisma()
  const boundedLimit = pageSize(limit)
  const cursor = decodeTimeCursor(after)
  const episodeWhere: Prisma.PodcastEpisodeWhereInput = {
    podcast: {
      subscriptions: {
        some: {
          isPaused: false,
          userId,
        },
      },
    },
  }
  const [subscriptions, episodes, unplayedCounts] = await Promise.all([
    prisma.podcastSubscription.findMany({
      where: { userId },
      include: {
        podcast: {
          include: {
            episodes: {
              orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
              take: 1,
            },
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { subscribedAt: "desc" }],
    }),
    prisma.podcastEpisode.findMany({
      where: cursor
        ? { AND: [episodeWhere, afterTimeCursorWhere(cursor, "publishedAt")] }
        : episodeWhere,
      include: {
        podcast: true,
        states: {
          where: { userId },
          take: 1,
        },
      },
      orderBy: [
        { publishedAt: { nulls: "last", sort: "desc" } },
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take: boundedLimit + 1,
    }),
    prisma.podcastEpisode.groupBy({
      by: ["podcastId"],
      _count: { _all: true },
      where: {
        podcast: {
          subscriptions: {
            some: {
              isPaused: false,
              userId,
            },
          },
        },
        OR: [
          { states: { none: { userId } } },
          { states: { some: { userId, isPlayed: false } } },
        ],
      },
    }),
  ])

  const unplayedCountByPodcastId = new Map(
    unplayedCounts.map((row) => [row.podcastId, row._count._all])
  )

  const visibleEpisodes = episodes.slice(0, boundedLimit)

  return {
    episodes: visibleEpisodes.map(mapEpisode),
    nextEpisodeCursor:
      episodes.length > boundedLimit && visibleEpisodes.length
        ? encodeTimeCursor(visibleEpisodes.at(-1)!)
        : null,
    subscriptions: subscriptions.map((subscription) => ({
      artworkUrl: subscription.podcast.artworkUrl,
      id: subscription.podcast.id,
      lastError: subscription.podcast.lastError,
      latestEpisodeTitle: subscription.podcast.episodes[0]?.title ?? null,
      subscriptionId: subscription.id,
      title: subscription.customTitle || subscription.podcast.title,
      unplayedCount: unplayedCountByPodcastId.get(subscription.podcastId) ?? 0,
    })),
  }
}

export async function getPodcastShowForUser({
  after,
  limit = 50,
  podcastId,
  userId,
}: {
  after?: string
  limit?: number
  podcastId: string
  userId: string
}) {
  const boundedLimit = pageSize(limit)
  const cursor = decodeTimeCursor(after)
  const podcast = await getPrisma().podcast.findFirst({
    where: {
      id: podcastId,
      subscriptions: {
        some: {
          userId,
        },
      },
    },
    include: {
      episodes: {
        include: {
          states: {
            where: { userId },
            take: 1,
          },
        },
        orderBy: [
          { publishedAt: { nulls: "last", sort: "desc" } },
          { createdAt: "desc" },
          { id: "desc" },
        ],
        take: boundedLimit + 1,
        where: cursor ? afterTimeCursorWhere(cursor, "publishedAt") : undefined,
      },
    },
  })

  if (!podcast) {
    return null
  }

  const visibleEpisodes = podcast.episodes.slice(0, boundedLimit)

  return {
    episodes: visibleEpisodes.map((episode) =>
      mapEpisode({
        ...episode,
        podcast,
        states: episode.states,
      })
    ),
    nextEpisodeCursor:
      podcast.episodes.length > boundedLimit && visibleEpisodes.length
        ? encodeTimeCursor(visibleEpisodes.at(-1)!)
        : null,
    podcast: {
      artworkUrl: podcast.artworkUrl,
      description: podcast.description,
      id: podcast.id,
      lastError: podcast.lastError,
      title: podcast.title,
      url: podcast.siteUrl,
    },
  }
}

function mapEpisode(
  episode: Prisma.PodcastEpisodeGetPayload<{
    include: {
      podcast: true
      states: true
    }
  }>
) {
  const state = episode.states[0]

  return {
    audioType: episode.audioType,
    audioUrl: episode.audioUrl,
    description: episode.description,
    durationSeconds: episode.durationSeconds,
    episodeId: episode.id,
    imageUrl: episode.imageUrl || episode.podcast.artworkUrl,
    isPlayed: state?.isPlayed ?? false,
    isStarred: state?.isStarred ?? false,
    playbackPositionSeconds: state?.playbackPositionSeconds ?? 0,
    podcastId: episode.podcastId,
    podcastTitle: episode.podcast.title,
    publishedAt: episode.publishedAt,
    title: episode.title,
    url: episode.url,
  }
}

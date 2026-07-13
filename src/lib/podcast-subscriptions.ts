import { cache } from "react"
import { Prisma } from "../generated/prisma/client"

import { getPrisma } from "./db"
import { fetchPodcastFeedText } from "./podcast-fetch"
import { parsePodcastFeed, PodcastParseError } from "./podcast-parser"
import { refreshPodcastWithClient } from "./podcast-refresh"
import {
  assertUserCanAddSource,
  isDatabaseSourceLimitError,
  SourceLimitError,
} from "./source-limits"
import {
  FeedFetchError,
  normalizeHttpUrl,
  UnsafeUrlError,
} from "./url-safety"

export class PodcastSubscriptionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PodcastSubscriptionError"
  }
}

export type PodcastSubscriptionWithPodcast = Prisma.PodcastSubscriptionGetPayload<{
  include: {
    podcast: true
  }
}>

export const listUserPodcastSubscriptions = cache(
  async function listUserPodcastSubscriptions(
    userId: string
  ): Promise<PodcastSubscriptionWithPodcast[]> {
    return getPrisma().podcastSubscription.findMany({
      where: { userId },
      include: {
        podcast: true,
      },
      orderBy: [{ sortOrder: "asc" }, { subscribedAt: "desc" }],
    })
  }
)

export async function getUserPodcastSubscription({
  podcastId,
  userId,
}: {
  podcastId: string
  userId: string
}) {
  return getPrisma().podcastSubscription.findFirst({
    where: {
      podcastId,
      userId,
    },
    include: {
      podcast: true,
    },
  })
}

export async function unsubscribeFromPodcast({
  subscriptionId,
  userId,
}: {
  subscriptionId: string
  userId: string
}) {
  const prisma = getPrisma()
  const subscription = await prisma.podcastSubscription.findFirst({
    where: {
      id: subscriptionId,
      userId,
    },
    select: {
      id: true,
    },
  })

  if (!subscription) {
    throw new PodcastSubscriptionError("Podcast subscription was not found.")
  }

  const deletion = await prisma.podcastSubscription.deleteMany({
    where: {
      id: subscriptionId,
      userId,
    },
  })

  if (deletion.count !== 1) {
    throw new PodcastSubscriptionError("Podcast subscription was not found.")
  }

  return {
    subscriptionId: subscription.id,
  }
}

export async function subscribeToPodcast({
  url,
  userId,
}: {
  url: string
  userId: string
}) {
  const prisma = getPrisma()
  let normalizedUrl: URL

  try {
    normalizedUrl = normalizeHttpUrl(url)
  } catch (error) {
    throwReadablePodcastError(error)
  }

  let sourceCountBeforeSubscribe = 0

  try {
    const sourceLimit = await assertUserCanAddSource({ userId })
    sourceCountBeforeSubscribe = sourceLimit.currentSourceCount
  } catch (error) {
    if (error instanceof SourceLimitError) {
      throw new PodcastSubscriptionError(error.message)
    }

    throw error
  }

  let response
  let parsedPodcast

  try {
    response = await fetchPodcastFeedText(normalizedUrl)
    parsedPodcast = parsePodcastFeed(response.text, response.url.href)
  } catch (error) {
    throwReadablePodcastError(error)
  }

  const existingSubscription = await prisma.podcastSubscription.findFirst({
    where: {
      userId,
      podcast: {
        feedUrl: parsedPodcast.feedUrl,
      },
    },
    select: {
      podcast: {
        select: {
          title: true,
        },
      },
    },
  })

  if (existingSubscription) {
    throw new PodcastSubscriptionError(
      `You are already subscribed to ${existingSubscription.podcast.title}.`
    )
  }

  const now = new Date()
  const podcast = await prisma.podcast.upsert({
    where: {
      feedUrl: parsedPodcast.feedUrl,
    },
    create: withoutUndefined({
      artworkUrl: parsedPodcast.artworkUrl,
      author: parsedPodcast.author,
      description: parsedPodcast.description,
      feedUrl: parsedPodcast.feedUrl,
      language: parsedPodcast.language,
      lastError: null,
      lastFailedAt: null,
      lastFetchedAt: now,
      lastSuccessfulFetchAt: now,
      siteUrl: parsedPodcast.siteUrl,
      title: parsedPodcast.title,
    }),
    update: withoutUndefined({
      artworkUrl: parsedPodcast.artworkUrl,
      author: parsedPodcast.author,
      description: parsedPodcast.description,
      language: parsedPodcast.language,
      lastError: null,
      lastFailedAt: null,
      lastFetchedAt: now,
      lastSuccessfulFetchAt: now,
      siteUrl: parsedPodcast.siteUrl,
      title: parsedPodcast.title,
    }),
  })

  let subscription: PodcastSubscriptionWithPodcast

  try {
    subscription = await prisma.podcastSubscription.create({
      data: {
        podcastId: podcast.id,
        userId,
      },
      include: {
        podcast: true,
      },
    })
  } catch (error) {
    if (isDatabaseSourceLimitError(error)) {
      throw new PodcastSubscriptionError(
        "Free accounts can subscribe to up to 200 sources."
      )
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new PodcastSubscriptionError(
        `You are already subscribed to ${podcast.title}.`
      )
    }

    throw error
  }

  let initialEpisodeCount: number | undefined

  try {
    const result = await refreshPodcastWithClient({
      podcastId: podcast.id,
      fetchText: async () => response,
    })
    initialEpisodeCount = result.episodeCount
  } catch {
    // The subscription is committed; the normal podcast refresh cycle can retry.
  }

  return {
    ...subscription,
    initialEpisodeCount,
    sourceCountBeforeSubscribe,
  }
}

function withoutUndefined<T extends Record<string, unknown>>(values: T) {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined)
  ) as T
}

function throwReadablePodcastError(error: unknown): never {
  if (
    error instanceof FeedFetchError ||
    error instanceof PodcastParseError ||
    error instanceof UnsafeUrlError
  ) {
    throw new PodcastSubscriptionError(error.message)
  }

  throw error
}

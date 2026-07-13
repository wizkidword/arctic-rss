import { Prisma } from "../generated/prisma/client"
import { cache } from "react"

import { countUnreadArticlesForFeed } from "./articles"
import { discoverFeedFromUrl } from "./feed-discovery"
import {
  feedDirectoryFeeds,
  isDirectoryFeedSubscribed,
} from "./feed-directory"
import { refreshFeedWithClient } from "./feed-refresh"
import { getPrisma } from "./db"
import {
  assertUserCanAddSource,
  isDatabaseSourceLimitError,
  SourceLimitError,
} from "./source-limits"

export class FeedSubscriptionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "FeedSubscriptionError"
  }
}

export type FeedSubscriptionNavItem = {
  faviconUrl: string | null
  feedId: string
  feedUrl: string
  folderId: string | null
  folderName: string | null
  id: string
  isPaused: boolean
  lastError: string | null
  siteUrl: string | null
  title: string
  unreadCount: number
}

type FeedSubscriptionWithFeed = Prisma.FeedSubscriptionGetPayload<{
  include: {
    feed: true
  }
}>

export const listUserFeedSubscriptions = cache(async function listUserFeedSubscriptions(
  userId: string
): Promise<FeedSubscriptionNavItem[]> {
  const subscriptions = await getPrisma().feedSubscription.findMany({
    where: { userId },
    include: {
      feed: true,
      folder: true,
    },
    orderBy: [{ sortOrder: "asc" }, { subscribedAt: "desc" }],
  })

  return Promise.all(
    subscriptions.map(async (subscription) => ({
      faviconUrl: subscription.feed.faviconUrl,
      feedId: subscription.feedId,
      feedUrl: subscription.feed.feedUrl,
      folderId: subscription.folderId,
      folderName: subscription.folder?.name ?? null,
      id: subscription.id,
      isPaused: subscription.isPaused,
      lastError: subscription.feed.lastError,
      siteUrl: subscription.feed.siteUrl,
      title: subscription.customTitle || subscription.feed.title,
      unreadCount: await countUnreadArticlesForFeed(userId, subscription.feedId),
    }))
  )
})

export async function hasUserFeedSubscriptions(userId: string) {
  const subscription = await getPrisma().feedSubscription.findFirst({
    where: { userId },
    select: { id: true },
  })

  return Boolean(subscription)
}

export async function getUserFeedSubscription(
  userId: string,
  subscriptionId: string
) {
  return getPrisma().feedSubscription.findFirst({
    where: {
      id: subscriptionId,
      userId,
    },
    include: {
      feed: true,
      folder: true,
    },
  })
}

export async function unsubscribeFromFeed({
  subscriptionId,
  userId,
}: {
  subscriptionId: string
  userId: string
}) {
  const prisma = getPrisma()
  const subscription = await prisma.feedSubscription.findFirst({
    where: {
      id: subscriptionId,
      userId,
    },
    select: {
      id: true,
      customTitle: true,
      feed: {
        select: {
          title: true,
        },
      },
    },
  })

  if (!subscription) {
    throw new FeedSubscriptionError(
      "That feed subscription was not found."
    )
  }

  const deletion = await prisma.feedSubscription.deleteMany({
    where: {
      id: subscriptionId,
      userId,
    },
  })

  if (deletion.count !== 1) {
    throw new FeedSubscriptionError(
      "That feed subscription was not found."
    )
  }

  return {
    id: subscription.id,
    title: subscription.customTitle || subscription.feed.title,
  }
}

export async function subscribeToFeed({
  folderId,
  folderName,
  url,
  userId,
}: {
  folderId?: string
  folderName?: string
  url: string
  userId: string
}) {
  const prisma = getPrisma()
  const normalizedFolderId = folderId?.trim() || undefined
  const shouldCreateFolder = folderName !== undefined

  if (normalizedFolderId) {
    const folder = await prisma.folder.findFirst({
      where: {
        id: normalizedFolderId,
        userId,
      },
      select: { id: true },
    })

    if (!folder) {
      throw new FeedSubscriptionError("That folder does not exist.")
    }
  }

  const discoveredFeed = await discoverFeedFromUrl(url)
  const directoryFeed = feedDirectoryFeeds.find((feed) =>
    isDirectoryFeedSubscribed(feed, [discoveredFeed.feedUrl])
  )

  if (directoryFeed) {
    const existingSubscriptions = await prisma.feedSubscription.findMany({
      where: { userId },
      select: {
        feed: {
          select: {
            feedUrl: true,
            title: true,
          },
        },
      },
    })
    const existingSubscription = existingSubscriptions.find((subscription) =>
      isDirectoryFeedSubscribed(directoryFeed, [subscription.feed.feedUrl])
    )

    if (existingSubscription) {
      throw new FeedSubscriptionError(
        `You are already subscribed to ${existingSubscription.feed.title}.`
      )
    }
  }

  const persistedFeedUrl = directoryFeed?.url ?? discoveredFeed.feedUrl
  const existingDirectSubscription = await prisma.feedSubscription.findFirst({
    where: {
      userId,
      feed: {
        feedUrl: persistedFeedUrl,
      },
    },
    select: {
      feed: {
        select: {
          title: true,
        },
      },
    },
  })

  if (existingDirectSubscription) {
    throw new FeedSubscriptionError(
      `You are already subscribed to ${existingDirectSubscription.feed.title}.`
    )
  }

  let sourceCountBeforeSubscribe = 0

  try {
    const sourceLimit = await assertUserCanAddSource({ userId })
    sourceCountBeforeSubscribe = sourceLimit.currentSourceCount
  } catch (error) {
    if (error instanceof SourceLimitError) {
      throw new FeedSubscriptionError(error.message)
    }

    throw error
  }

  let resolvedFolderId = normalizedFolderId

  if (!resolvedFolderId && shouldCreateFolder) {
    const folder = await prisma.folder.create({
      data: {
        name: normalizeFolderName(folderName),
        userId,
      },
      select: {
        id: true,
        name: true,
      },
    })
    resolvedFolderId = folder.id
  }

  const now = new Date()

  const feed = await prisma.feed.upsert({
    where: { feedUrl: persistedFeedUrl },
    create: {
      description: discoveredFeed.description,
      faviconUrl: discoveredFeed.faviconUrl,
      feedUrl: persistedFeedUrl,
      language: discoveredFeed.language,
      lastError: null,
      lastFetchedAt: now,
      lastFailedAt: null,
      lastSuccessfulFetchAt: now,
      siteUrl: discoveredFeed.siteUrl,
      title: discoveredFeed.title,
    },
    update: {
      description: discoveredFeed.description,
      faviconUrl: discoveredFeed.faviconUrl,
      language: discoveredFeed.language,
      lastError: null,
      lastFetchedAt: now,
      lastFailedAt: null,
      lastSuccessfulFetchAt: now,
      siteUrl: discoveredFeed.siteUrl,
      title: discoveredFeed.title,
    },
  })

  let subscription: FeedSubscriptionWithFeed

  try {
    subscription = await prisma.feedSubscription.create({
      data: {
        feedId: feed.id,
        folderId: resolvedFolderId,
        userId,
      },
      include: {
        feed: true,
      },
    })
  } catch (error) {
    if (isDatabaseSourceLimitError(error)) {
      throw new FeedSubscriptionError(
        "Free accounts can subscribe to up to 200 sources."
      )
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new FeedSubscriptionError(
        `You are already subscribed to ${feed.title}.`
      )
    }

    throw error
  }

  let initialArticleCount: number | undefined

  try {
    const result = await refreshFeedWithClient({
      feedId: feed.id,
      fetchText: async () => ({
        contentType:
          discoveredFeed.format === "atom"
            ? "application/atom+xml"
            : "application/rss+xml",
        text: discoveredFeed.feedXml,
        url: new URL(persistedFeedUrl),
      }),
    })
    initialArticleCount = result.articleCount
  } catch {
    // The subscription is committed; the normal feed refresh cycle can retry.
  }

  return {
    ...subscription,
    initialArticleCount,
    sourceCountBeforeSubscribe,
  }
}

function normalizeFolderName(name: string) {
  const normalizedName = name.trim().replace(/\s+/g, " ")

  if (!normalizedName) {
    throw new FeedSubscriptionError("Folder name is required.")
  }

  if (normalizedName.length > 80) {
    throw new FeedSubscriptionError(
      "Folder name must be 80 characters or fewer."
    )
  }

  return normalizedName
}

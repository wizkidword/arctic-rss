import { Prisma } from "../generated/prisma/client"

import { countUnreadArticlesForFeed } from "./articles"
import { discoverFeedFromUrl } from "./feed-discovery"
import { getPrisma } from "./db"

export class FeedSubscriptionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "FeedSubscriptionError"
  }
}

export type FeedSubscriptionNavItem = {
  faviconUrl: string | null
  feedId: string
  folderId: string | null
  folderName: string | null
  id: string
  isPaused: boolean
  lastError: string | null
  siteUrl: string | null
  title: string
  unreadCount: number
}

export async function listUserFeedSubscriptions(
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
  url,
  userId,
}: {
  folderId?: string
  url: string
  userId: string
}) {
  const prisma = getPrisma()
  const normalizedFolderId = folderId?.trim() || undefined

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
  const now = new Date()

  const feed = await prisma.feed.upsert({
    where: { feedUrl: discoveredFeed.feedUrl },
    create: {
      description: discoveredFeed.description,
      faviconUrl: discoveredFeed.faviconUrl,
      feedUrl: discoveredFeed.feedUrl,
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

  try {
    return await prisma.feedSubscription.create({
      data: {
        feedId: feed.id,
        folderId: normalizedFolderId,
        userId,
      },
      include: {
        feed: true,
      },
    })
  } catch (error) {
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
}

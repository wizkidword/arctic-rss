import type { PrismaClient } from "@/generated/prisma/client"

import { getPrisma } from "@/lib/db"
import { getDiscoverDirectory, type DiscoverDirectory } from "@/lib/discover-directory"

import {
  getSubscriptionInterestIds,
  rankChatDirectoryRooms,
  type RankedChatDirectoryRoom,
} from "./room-directory"
import { listChatRooms } from "./room-service"

type ArticleRecommendationStore = Pick<PrismaClient, "article">

export type ArticleChatRoomRecommendation = RankedChatDirectoryRoom

/**
 * Returns only public room metadata. The article lookup is scoped to a current
 * subscription, so this helper never turns an arbitrary article ID into a
 * feed-interest lookup.
 */
export async function listChatRoomRecommendationsForArticle({
  articleId,
  getDirectory = getDiscoverDirectory,
  getRooms = listChatRooms,
  store = getPrisma(),
  userId,
}: {
  articleId: string
  getDirectory?: () => Promise<DiscoverDirectory>
  getRooms?: () => ReturnType<typeof listChatRooms>
  store?: ArticleRecommendationStore
  userId: string
}): Promise<ArticleChatRoomRecommendation[]> {
  const article = await store.article.findFirst({
    select: { feed: { select: { feedUrl: true } } },
    where: {
      id: articleId,
      feed: { subscriptions: { some: { userId } } },
    },
  })

  if (!article) {
    return []
  }

  const [directory, rooms] = await Promise.all([getDirectory(), getRooms()])
  const interestIds = getSubscriptionInterestIds({
    directory,
    feedUrls: [article.feed.feedUrl],
  })

  return rankChatDirectoryRooms({ interestIds, rooms })
}

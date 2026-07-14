import type { DiscoverDirectory } from "@/lib/discover-directory"
import { getDiscoverInterestId } from "@/lib/discover-interests"

export type ChatDirectoryRoom = {
  description: string
  id: string
  interestIds: string[]
  isOfficial: boolean
  name: string
  slug: string
  topicLine: string | null
}

export type RankedChatDirectoryRoom = ChatDirectoryRoom & {
  matchedInterestIds: string[]
  score: number
}

export function getSubscriptionInterestIds({
  directory,
  feedUrls,
}: {
  directory: DiscoverDirectory
  feedUrls: readonly string[]
}) {
  const subscribedUrls = new Set(feedUrls)
  const categoriesById = new Map(
    directory.categories.map((category) => [category.id, category])
  )

  return new Set(
    directory.feeds
      .filter((feed) => subscribedUrls.has(feed.url))
      .map((feed) =>
        getDiscoverInterestId(categoriesById.get(feed.categoryId) ?? feed.categoryId)
      )
  )
}

export function rankChatDirectoryRooms({
  interestIds,
  rooms,
  search,
}: {
  interestIds?: ReadonlySet<string>
  rooms: readonly ChatDirectoryRoom[]
  search?: string
}): RankedChatDirectoryRoom[] {
  const normalizedSearch = search?.trim().toLowerCase()

  return rooms
    .filter((room) => {
      if (!normalizedSearch) {
        return true
      }

      return [room.name, room.slug, room.description, room.topicLine ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch)
    })
    .map((room) => {
      const matchedInterestIds = room.interestIds.filter((interestId) =>
        interestIds?.has(interestId)
      )

      return {
        ...room,
        matchedInterestIds,
        score: matchedInterestIds.length,
      }
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        Number(right.isOfficial) - Number(left.isOfficial) ||
        left.name.localeCompare(right.name)
    )
}

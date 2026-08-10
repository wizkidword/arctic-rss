import type {
  ArticleDetail,
  ArticleListItem,
  Briefing,
  BriefingDetail,
  Collection,
  Feed,
  Me,
  PodcastEpisode,
  PodcastEpisodeDetail,
  SavedView,
} from "@arctic-rss/api-contract"

import { listArticleCollectionsForUser } from "@/lib/article-collections"
import { listCollectionArticleRetentionForUser } from "@/lib/collection-retention"
import {
  getReaderArticleForUser,
  listReaderArticlePage,
  type ReaderArticle,
  type ReaderArticleListItem,
} from "@/lib/articles"
import {
  listReaderArticleSearchPage,
  parseArticleSearchFilters,
} from "@/lib/article-search"
import { buildAppUrl } from "@/lib/app-origin"
import { getPrisma } from "@/lib/db"
import { listUserFeedNavigation } from "@/lib/feed-subscriptions"
import { imageProxyUrl } from "@/lib/image-proxy-url"
import {
  getPodcastEpisodeForUser,
  getPodcastHomeForUser,
  type PodcastEpisodeDetail as DomainPodcastEpisodeDetail,
  type PodcastHomeEpisode,
} from "@/lib/podcasts"
import { listSavedSearchPageForUser } from "@/lib/saved-searches"
import { getSmartDigestForUser, listSmartDigestPageForUser } from "@/lib/smart-digests"

import { apiV1NotFoundError } from "./route"

export async function getApiV1Me(userId: string): Promise<Me> {
  const user = await getPrisma().user.findUnique({
    select: {
      email: true,
      id: true,
      name: true,
      plan: true,
    },
    where: { id: userId },
  })

  if (!user) {
    throw new Error("Fresh user disappeared before mobile API profile lookup.")
  }

  return user
}

export async function listApiV1Reader({
  collectionId,
  cursor,
  feedId,
  folderId,
  limit,
  state,
  userId,
}: {
  collectionId?: string
  cursor?: string
  feedId?: string
  folderId?: string
  limit: number
  state: "all" | "starred" | "unread"
  userId: string
}) {
  const page = await listReaderArticlePage({
    after: cursor,
    collectionId,
    feedId,
    folderId,
    limit,
    starredOnly: state === "starred",
    unreadOnly: state === "unread",
    userId,
  })

  const retentionByArticleId = collectionId
    ? await listCollectionArticleRetentionForUser({
        articleIds: page.articles.map((article) => article.id),
        collectionId,
        userId,
      })
    : new Map()

  return {
    articles: page.articles.map((article) => {
      const collectionRetention = retentionByArticleId.get(article.id)

      return toApiV1ArticleListItem(
        collectionRetention ? { ...article, collectionRetention } : article
      )
    }),
    nextCursor: page.nextCursor,
  }
}

export async function getApiV1Article({
  articleId,
  userId,
}: {
  articleId: string
  userId: string
}): Promise<ArticleDetail> {
  const article = await getReaderArticleForUser({ articleId, userId })

  if (!article) {
    throw apiV1NotFoundError("ARTICLE_NOT_FOUND", "That article is unavailable.")
  }

  return toApiV1ArticleDetail(article)
}

export async function searchApiV1Articles({
  collectionId,
  cursor,
  folderId,
  from,
  limit,
  q,
  sourceId,
  state,
  to,
  userId,
}: {
  collectionId?: string
  cursor?: string
  folderId?: string
  from?: string
  limit: number
  q: string
  sourceId?: string
  state: "all" | "read" | "starred" | "unread"
  to?: string
  userId: string
}) {
  const filters = parseArticleSearchFilters({
    after: cursor,
    collection: collectionId,
    folder: folderId,
    from,
    q,
    source: sourceId,
    state,
    to,
  })
  const page = await listReaderArticleSearchPage({ filters, limit, userId })

  return {
    articles: page.articles.map(toApiV1ArticleListItem),
    nextCursor: page.nextCursor,
  }
}

export async function listApiV1SavedViews({
  cursor,
  limit,
  userId,
}: {
  cursor?: string
  limit: number
  userId: string
}) {
  const page = await listSavedSearchPageForUser({ after: cursor, limit, userId })

  return {
    nextCursor: page.nextCursor,
    savedViews: page.savedSearches.map((savedView): SavedView => ({
    collectionId: savedView.collectionId,
    description: savedView.description,
    folderId: savedView.folderId,
    id: savedView.id,
    monitorEnabled: savedView.monitorEnabled,
    monitorNewMatchCount: savedView.monitorNewMatchCount,
    name: savedView.name,
    publishedAfter: timestamp(savedView.publishedAfter),
    publishedBefore: timestamp(savedView.publishedBefore),
    query: savedView.query,
    sourceId: savedView.subscriptionId,
    state: normalizeSavedViewState(savedView.state),
    updatedAt: savedView.updatedAt.toISOString(),
    })),
  }
}

export async function listApiV1Collections(userId: string): Promise<Collection[]> {
  const collections = await listArticleCollectionsForUser(userId)

  return collections.map((collection) => ({
    id: collection.id,
    itemCount: collection.articleCount,
    name: collection.name,
  }))
}

export async function listApiV1Feeds(userId: string): Promise<Feed[]> {
  const feeds = await listUserFeedNavigation(userId)

  return feeds.map((feed) => ({
    faviconUrl: mediaUrl(feed.faviconUrl),
    id: feed.feedId,
    isPaused: feed.isPaused,
    needsAttention: feed.needsAttention,
    subscriptionId: feed.id,
    title: feed.title,
    unreadCount: feed.unreadCount,
  }))
}

export async function listApiV1Podcasts({
  cursor,
  limit,
  userId,
}: {
  cursor?: string
  limit: number
  userId: string
}) {
  const home = await getPodcastHomeForUser(userId, { after: cursor, limit })

  return {
    episodes: home.episodes.map(toApiV1PodcastEpisode),
    nextCursor: home.nextEpisodeCursor,
    podcasts: home.subscriptions.map((podcast) => ({
      artworkUrl: mediaUrl(podcast.artworkUrl),
      id: podcast.id,
      latestEpisodeTitle: podcast.latestEpisodeTitle,
      subscriptionId: podcast.subscriptionId,
      title: podcast.title,
      unplayedCount: podcast.unplayedCount,
    })),
  }
}

export async function getApiV1PodcastEpisode({
  episodeId,
  userId,
}: {
  episodeId: string
  userId: string
}): Promise<PodcastEpisodeDetail> {
  const episode = await getPodcastEpisodeForUser({ episodeId, userId })

  if (!episode) {
    throw apiV1NotFoundError(
      "PODCAST_EPISODE_NOT_FOUND",
      "That podcast episode is unavailable."
    )
  }

  return toApiV1PodcastEpisodeDetail(episode)
}

export async function listApiV1Briefings({
  cursor,
  limit,
  userId,
}: {
  cursor?: string
  limit: number
  userId: string
}) {
  const page = await listSmartDigestPageForUser({ after: cursor, limit, userId })

  return {
    briefings: page.digests.map((digest): Briefing => ({
      articleCount: digest.articleCount,
      completedAt: timestamp(digest.completedAt),
      createdAt: digest.createdAt.toISOString(),
      id: digest.id,
      status: digest.status,
      title: digest.title,
    })),
    nextCursor: page.nextCursor,
  }
}

export async function getApiV1Briefing({
  briefingId,
  userId,
}: {
  briefingId: string
  userId: string
}): Promise<BriefingDetail> {
  const briefing = await getSmartDigestForUser({ digestId: briefingId, userId })

  if (!briefing) {
    throw apiV1NotFoundError("BRIEFING_NOT_FOUND", "That briefing is unavailable.")
  }

  return {
    articleCount: briefing.articleCount,
    completedAt: timestamp(briefing.completedAt),
    createdAt: briefing.createdAt.toISOString(),
    emailErrorMessage: boundedText(briefing.emailErrorMessage, 2_000),
    emailStatus: briefing.emailStatus,
    errorMessage: boundedText(briefing.errorMessage, 2_000),
    id: briefing.id,
    items: briefing.items.slice(0, 200).map((item) => ({
      articleId: item.articleId,
      articleTitle: boundedText(item.articleTitle, 2_000) ?? "Untitled article",
      articleUrl: item.articleUrl,
      feedTitle: boundedText(item.feedTitle, 500) ?? "Unknown feed",
      id: item.id,
      matchedTerms: item.matchedTerms.slice(0, 50).map((term) => boundedText(term, 500) ?? ""),
      position: item.position,
      publishedAt: timestamp(item.publishedAt),
      reason: boundedText(item.reason, 2_000) ?? "",
      summary: boundedText(item.summary, 20_000) ?? "",
    })),
    rule: {
      id: briefing.rule.id,
      name: boundedText(briefing.rule.name, 500) ?? "Smart Digest",
    },
    status: briefing.status,
    title: boundedText(briefing.title, 500) ?? "Smart Digest",
    topicPrompt: boundedText(briefing.topicPrompt, 10_000) ?? "",
  }
}

function toApiV1ArticleListItem(article: ReaderArticleListItem): ArticleListItem {
  return {
    ...(article.collectionRetention
      ? {
          collectionRetention: {
            savedAt: article.collectionRetention.savedAt.toISOString(),
            sourceIsFollowed: article.collectionRetention.sourceIsFollowed,
          },
        }
      : {}),
    feed: {
      faviconUrl: mediaUrl(article.feedFaviconUrl),
      id: article.feedId,
      title: article.feedTitle,
    },
    id: article.id,
    imageUrl: mediaUrl(article.imageUrl),
    isRead: article.isRead,
    isStarred: article.isStarred,
    publishedAt: timestamp(article.publishedAt),
    summary: article.summary,
    title: article.title,
    url: article.url,
  }
}

function toApiV1ArticleDetail(article: ReaderArticle): ArticleDetail {
  return {
    ...toApiV1ArticleListItem(article),
    author: article.author,
    contentHtml: article.sanitizedContentHtml,
    contentText: article.contentText,
    readAt: timestamp(article.readAt),
    starredAt: timestamp(article.starredAt),
  }
}

function toApiV1PodcastEpisode(episode: PodcastHomeEpisode): PodcastEpisode {
  return {
    audioType: episode.audioType,
    audioUrl: episode.audioUrl,
    description: episode.description,
    durationSeconds: episode.durationSeconds,
    id: episode.episodeId,
    imageUrl: mediaUrl(episode.imageUrl),
    isPlayed: episode.isPlayed,
    isStarred: episode.isStarred,
    playbackPositionSeconds: episode.playbackPositionSeconds,
    podcast: {
      id: episode.podcastId,
      title: episode.podcastTitle,
    },
    publishedAt: timestamp(episode.publishedAt),
    title: episode.title,
    url: episode.url,
  }
}

function boundedText(value: string | null, maximum: number) {
  if (value === null) {
    return null
  }
  return value.length <= maximum ? value : `${value.slice(0, maximum - 1)}…`
}

function toApiV1PodcastEpisodeDetail(
  episode: DomainPodcastEpisodeDetail
): PodcastEpisodeDetail {
  return {
    ...toApiV1PodcastEpisode(episode),
    contentText: episode.contentText,
  }
}

function apiUrl(value: string | null) {
  if (!value) {
    return null
  }

  return value.startsWith("/") ? buildAppUrl(value).href : value
}

function mediaUrl(value: string | null) {
  return apiUrl(imageProxyUrl(value))
}

function normalizeSavedViewState(value: string): "all" | "read" | "starred" | "unread" {
  return value === "read" || value === "starred" || value === "unread"
    ? value
    : "all"
}

function timestamp(value: Date | null) {
  return value?.toISOString() ?? null
}

import { getPrisma } from "./db"

export const ACCOUNT_EXPORT_SCHEMA_VERSION = 1
export const MAX_ACCOUNT_EXPORT_BYTES = 8 * 1024 * 1024

export const ACCOUNT_EXPORT_LIMITS = {
  collectionItems: 10_000,
  collections: 200,
  feedSubscriptions: 1_000,
  folders: 500,
  podcastSubscriptions: 1_000,
  savedSearches: 500,
  smartDigestRules: 200,
  starredArticleReferences: 10_000,
} as const

export class AccountExportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AccountExportError"
  }
}

export type AccountExport = {
  exportedAt: string
  format: "arctic-rss-account-export"
  readerSettings: {
    aiAutoSummariesEnabled: boolean
    dailyDigestEnabled: boolean
    dateFormat: string
    defaultView: string
    displayMode: string
    fontSize: string
    markReadOnOpen: boolean
    openLinksInNewTab: boolean
    theme: string
    timeFormat: string
    timeZone: string
  } | null
  savedSearches: Array<{
    collectionId: string | null
    definitionVersion: number
    description: string | null
    folderId: string | null
    id: string
    monitor: {
      action: string
      enabled: boolean
    }
    name: string
    publishedAfter: string | null
    publishedBefore: string | null
    query: string
    state: string
    subscriptionId: string | null
  }>
  schemaVersion: typeof ACCOUNT_EXPORT_SCHEMA_VERSION
  smartDigestRules: Array<{
    cadence: string
    emailEnabled: boolean
    excludeTerms: string[]
    folderIds: string[]
    id: string
    includeTerms: string[]
    isEnabled: boolean
    matchingMode: string
    name: string
    scheduledHour: number
    sourceScope: string
    subscriptionIds: string[]
    timeZone: string
    topicPrompt: string
  }>
  starredArticleReferences: Array<{
    articleId: string
    canonicalUrl: string | null
    feedUrl: string
    publishedAt: string | null
    starredAt: string | null
    title: string
    url: string
  }>
  subscriptions: {
    feeds: Array<{
      customTitle: string | null
      feedUrl: string
      folderId: string | null
      id: string
      isMuted: boolean
      isPaused: boolean
      siteUrl: string | null
      sortOrder: number
      subscribedAt: string
      title: string
    }>
    podcasts: Array<{
      customTitle: string | null
      feedUrl: string
      id: string
      isMuted: boolean
      isPaused: boolean
      siteUrl: string | null
      sortOrder: number
      subscribedAt: string
      title: string
    }>
  }
  folders: Array<{
    id: string
    name: string
    sortOrder: number
  }>
  collections: Array<{
    id: string
    itemReferences: Array<{
      articleId: string | null
      podcastEpisodeId: string | null
      savedAt: string
    }>
    name: string
    sortOrder: number
  }>
}

export async function buildAccountExport({
  exportedAt = new Date(),
  userId,
}: {
  exportedAt?: Date
  userId: string
}): Promise<AccountExport> {
  const prisma = getPrisma()
  const [
    feedSubscriptions,
    podcastSubscriptions,
    folders,
    collections,
    collectionItems,
    starredArticleReferences,
    savedSearches,
    smartDigestRules,
    readerSettings,
  ] = await Promise.all([
    prisma.feedSubscription.findMany({
      orderBy: [{ sortOrder: "asc" }, { subscribedAt: "asc" }, { id: "asc" }],
      select: {
        customTitle: true,
        feed: {
          select: {
            feedUrl: true,
            siteUrl: true,
            title: true,
          },
        },
        folderId: true,
        id: true,
        isMuted: true,
        isPaused: true,
        sortOrder: true,
        subscribedAt: true,
      },
      take: ACCOUNT_EXPORT_LIMITS.feedSubscriptions + 1,
      where: { userId },
    }),
    prisma.podcastSubscription.findMany({
      orderBy: [{ sortOrder: "asc" }, { subscribedAt: "asc" }, { id: "asc" }],
      select: {
        customTitle: true,
        id: true,
        isMuted: true,
        isPaused: true,
        podcast: {
          select: {
            feedUrl: true,
            siteUrl: true,
            title: true,
          },
        },
        sortOrder: true,
        subscribedAt: true,
      },
      take: ACCOUNT_EXPORT_LIMITS.podcastSubscriptions + 1,
      where: { userId },
    }),
    prisma.folder.findMany({
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: { id: true, name: true, sortOrder: true },
      take: ACCOUNT_EXPORT_LIMITS.folders + 1,
      where: { userId },
    }),
    prisma.articleCollection.findMany({
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: { id: true, name: true, sortOrder: true },
      take: ACCOUNT_EXPORT_LIMITS.collections + 1,
      where: { userId },
    }),
    prisma.articleCollectionItem.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        articleId: true,
        collectionId: true,
        createdAt: true,
        podcastEpisodeId: true,
      },
      take: ACCOUNT_EXPORT_LIMITS.collectionItems + 1,
      where: { collection: { userId } },
    }),
    prisma.articleState.findMany({
      orderBy: [{ starredAt: "asc" }, { id: "asc" }],
      select: {
        article: {
          select: {
            canonicalUrl: true,
            id: true,
            publishedAt: true,
            title: true,
            url: true,
            feed: { select: { feedUrl: true } },
          },
        },
        starredAt: true,
      },
      take: ACCOUNT_EXPORT_LIMITS.starredArticleReferences + 1,
      where: { isStarred: true, userId },
    }),
    prisma.savedSearch.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        collectionId: true,
        definitionVersion: true,
        description: true,
        folderId: true,
        id: true,
        monitorAction: true,
        monitorEnabled: true,
        name: true,
        publishedAfter: true,
        publishedBefore: true,
        query: true,
        state: true,
        subscriptionId: true,
      },
      take: ACCOUNT_EXPORT_LIMITS.savedSearches + 1,
      where: { userId },
    }),
    prisma.smartDigestRule.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        cadence: true,
        emailEnabled: true,
        excludeTerms: true,
        folders: { select: { folderId: true } },
        id: true,
        includeTerms: true,
        isEnabled: true,
        matchingMode: true,
        name: true,
        scheduledHour: true,
        sourceScope: true,
        subscriptions: { select: { subscriptionId: true } },
        timeZone: true,
        topicPrompt: true,
      },
      take: ACCOUNT_EXPORT_LIMITS.smartDigestRules + 1,
      where: { userId },
    }),
    prisma.userSettings.findUnique({
      select: {
        aiAutoSummariesEnabled: true,
        dailyDigestEnabled: true,
        dateFormat: true,
        defaultView: true,
        displayMode: true,
        fontSize: true,
        markReadOnOpen: true,
        openLinksInNewTab: true,
        theme: true,
        timeFormat: true,
        timeZone: true,
      },
      where: { userId },
    }),
  ])

  assertBounded(feedSubscriptions, "feed subscriptions", ACCOUNT_EXPORT_LIMITS.feedSubscriptions)
  assertBounded(
    podcastSubscriptions,
    "podcast subscriptions",
    ACCOUNT_EXPORT_LIMITS.podcastSubscriptions
  )
  assertBounded(folders, "folders", ACCOUNT_EXPORT_LIMITS.folders)
  assertBounded(collections, "collections", ACCOUNT_EXPORT_LIMITS.collections)
  assertBounded(collectionItems, "collection item references", ACCOUNT_EXPORT_LIMITS.collectionItems)
  assertBounded(
    starredArticleReferences,
    "starred article references",
    ACCOUNT_EXPORT_LIMITS.starredArticleReferences
  )
  assertBounded(savedSearches, "saved searches", ACCOUNT_EXPORT_LIMITS.savedSearches)
  assertBounded(smartDigestRules, "Smart Digest rules", ACCOUNT_EXPORT_LIMITS.smartDigestRules)

  const itemReferencesByCollection = new Map<
    string,
    AccountExport["collections"][number]["itemReferences"]
  >()

  for (const item of collectionItems) {
    const itemReferences = itemReferencesByCollection.get(item.collectionId) ?? []
    itemReferences.push({
      articleId: item.articleId,
      podcastEpisodeId: item.podcastEpisodeId,
      savedAt: toIso(item.createdAt),
    })
    itemReferencesByCollection.set(item.collectionId, itemReferences)
  }

  return {
    collections: collections.map((collection) => ({
      id: collection.id,
      itemReferences: itemReferencesByCollection.get(collection.id) ?? [],
      name: collection.name,
      sortOrder: collection.sortOrder,
    })),
    exportedAt: toIso(exportedAt),
    folders,
    format: "arctic-rss-account-export",
    readerSettings,
    savedSearches: savedSearches.map((savedSearch) => ({
      collectionId: savedSearch.collectionId,
      definitionVersion: savedSearch.definitionVersion,
      description: savedSearch.description,
      folderId: savedSearch.folderId,
      id: savedSearch.id,
      monitor: {
        action: savedSearch.monitorAction,
        enabled: savedSearch.monitorEnabled,
      },
      name: savedSearch.name,
      publishedAfter: nullableToIso(savedSearch.publishedAfter),
      publishedBefore: nullableToIso(savedSearch.publishedBefore),
      query: savedSearch.query,
      state: savedSearch.state,
      subscriptionId: savedSearch.subscriptionId,
    })),
    schemaVersion: ACCOUNT_EXPORT_SCHEMA_VERSION,
    smartDigestRules: smartDigestRules.map((rule) => ({
      cadence: rule.cadence,
      emailEnabled: rule.emailEnabled,
      excludeTerms: rule.excludeTerms,
      folderIds: rule.folders.map(({ folderId }) => folderId).sort(),
      id: rule.id,
      includeTerms: rule.includeTerms,
      isEnabled: rule.isEnabled,
      matchingMode: rule.matchingMode,
      name: rule.name,
      scheduledHour: rule.scheduledHour,
      sourceScope: rule.sourceScope,
      subscriptionIds: rule.subscriptions.map(({ subscriptionId }) => subscriptionId).sort(),
      timeZone: rule.timeZone,
      topicPrompt: rule.topicPrompt,
    })),
    starredArticleReferences: starredArticleReferences.map(({ article, starredAt }) => ({
      articleId: article.id,
      canonicalUrl: article.canonicalUrl,
      feedUrl: article.feed.feedUrl,
      publishedAt: nullableToIso(article.publishedAt),
      starredAt: nullableToIso(starredAt),
      title: article.title,
      url: article.url,
    })),
    subscriptions: {
      feeds: feedSubscriptions.map((subscription) => ({
        customTitle: subscription.customTitle,
        feedUrl: subscription.feed.feedUrl,
        folderId: subscription.folderId,
        id: subscription.id,
        isMuted: subscription.isMuted,
        isPaused: subscription.isPaused,
        siteUrl: subscription.feed.siteUrl,
        sortOrder: subscription.sortOrder,
        subscribedAt: toIso(subscription.subscribedAt),
        title: subscription.feed.title,
      })),
      podcasts: podcastSubscriptions.map((subscription) => ({
        customTitle: subscription.customTitle,
        feedUrl: subscription.podcast.feedUrl,
        id: subscription.id,
        isMuted: subscription.isMuted,
        isPaused: subscription.isPaused,
        siteUrl: subscription.podcast.siteUrl,
        sortOrder: subscription.sortOrder,
        subscribedAt: toIso(subscription.subscribedAt),
        title: subscription.podcast.title,
      })),
    },
  }
}

export function serializeAccountExport(accountExport: AccountExport) {
  const serialized = JSON.stringify(accountExport)

  if (Buffer.byteLength(serialized, "utf8") > MAX_ACCOUNT_EXPORT_BYTES) {
    throw new AccountExportError(
      "Your account export is too large to download safely. Please contact support."
    )
  }

  return serialized
}

function assertBounded<T>(items: T[], label: string, limit: number) {
  if (items.length > limit) {
    throw new AccountExportError(
      `Your account has more than ${limit.toLocaleString()} ${label}, so it cannot be exported in one download.`
    )
  }
}

function nullableToIso(value: Date | null) {
  return value ? toIso(value) : null
}

function toIso(value: Date) {
  return value.toISOString()
}

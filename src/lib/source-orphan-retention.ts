import { Prisma, type PrismaClient } from "@/generated/prisma/client"

import { feedDirectoryFeeds } from "./feed-directory"
import { redditDirectoryFeeds } from "./reddit-directory"

export const SOURCE_ORPHAN_GRACE_PERIOD_DAYS = 60
export const SOURCE_ORPHAN_REPORT_VERSION = 1

export type SourceOrphanRetentionStore = Pick<PrismaClient, "$queryRaw">

type FeedOrphanReferences = {
  activeChatLegalHolds: number
  aiDigestItems: number
  articleAiSummaries: number
  articleStates: number
  auditLogReferences: number
  chatBotDeliveries: number
  chatMessageReferences: number
  chatRoomFeeds: number
  collectionItems: number
  dynamicDirectoryEntries: number
  smartDigestItems: number
  staticDirectoryEntries: number
  storyClusterMembers: number
}

type PodcastOrphanReferences = {
  collectionItems: number
  episodeStates: number
}

type SourceOrphanSummary<References> = {
  estimatedStoredBytes: string
  itemCount: number
  oldestOrphanSourceCreatedAt: string | null
  orphanSourceCount: number
  references: References
}

export type SourceOrphanRetentionReport = {
  dryRun: true
  feeds: SourceOrphanSummary<FeedOrphanReferences>
  generatedAt: string
  podcasts: SourceOrphanSummary<PodcastOrphanReferences>
  policy: {
    destructivePurgeEnabled: false
    gracePeriodDays: number
    purgeRequiresSeparateOwnerApproval: true
  }
  schemaVersion: typeof SOURCE_ORPHAN_REPORT_VERSION
}

type FeedReportRow = {
  activeChatLegalHolds: bigint | number | string
  aiDigestItems: bigint | number | string
  articleAiSummaries: bigint | number | string
  articleCount: bigint | number | string
  articleStates: bigint | number | string
  auditLogReferences: bigint | number | string
  chatBotDeliveries: bigint | number | string
  chatMessageReferences: bigint | number | string
  chatRoomFeeds: bigint | number | string
  collectionItems: bigint | number | string
  dynamicDirectoryEntries: bigint | number | string
  estimatedStoredBytes: bigint | number | string
  oldestOrphanSourceCreatedAt: Date | string | null
  orphanSourceCount: bigint | number | string
  smartDigestItems: bigint | number | string
  staticDirectoryEntries: bigint | number | string
  storyClusterMembers: bigint | number | string
}

type PodcastReportRow = {
  collectionItems: bigint | number | string
  episodeCount: bigint | number | string
  episodeStates: bigint | number | string
  estimatedStoredBytes: bigint | number | string
  oldestOrphanSourceCreatedAt: Date | string | null
  orphanSourceCount: bigint | number | string
}

/**
 * Reports currently unreferenced feed and podcast sources without mutating the
 * database. `createdAt` is the oldest available source timestamp, not proof of
 * when a source became orphaned; that state is intentionally not introduced
 * until a separately approved, bounded purge release.
 */
export async function reportSourceOrphanRetention({
  now = new Date(),
  store,
}: {
  now?: Date
  store: SourceOrphanRetentionStore
}): Promise<SourceOrphanRetentionReport> {
  const staticDirectoryUrls = [
    ...new Set(
      [...feedDirectoryFeeds, ...redditDirectoryFeeds].map((feed) => feed.url)
    ),
  ]
  const [feedRows, podcastRows] = await Promise.all([
    store.$queryRaw<FeedReportRow[]>(feedOrphanReportQuery(staticDirectoryUrls)),
    store.$queryRaw<PodcastReportRow[]>(podcastOrphanReportQuery),
  ])

  return {
    dryRun: true,
    feeds: mapFeedSummary(singleRow(feedRows, "feed")),
    generatedAt: now.toISOString(),
    podcasts: mapPodcastSummary(singleRow(podcastRows, "podcast")),
    policy: {
      destructivePurgeEnabled: false,
      gracePeriodDays: SOURCE_ORPHAN_GRACE_PERIOD_DAYS,
      purgeRequiresSeparateOwnerApproval: true,
    },
    schemaVersion: SOURCE_ORPHAN_REPORT_VERSION,
  }
}

function feedOrphanReportQuery(staticDirectoryUrls: string[]) {
  return Prisma.sql`
    WITH "orphanFeeds" AS (
      SELECT feed.*
      FROM "Feed" AS feed
      WHERE NOT EXISTS (
        SELECT 1
        FROM "FeedSubscription" AS subscription
        WHERE subscription."feedId" = feed."id"
      )
    ),
    "orphanArticles" AS (
      SELECT article.*
      FROM "Article" AS article
      INNER JOIN "orphanFeeds" AS feed ON feed."id" = article."feedId"
    )
    SELECT
      (SELECT COUNT(*)::bigint FROM "orphanFeeds") AS "orphanSourceCount",
      (SELECT COUNT(*)::bigint FROM "orphanArticles") AS "articleCount",
      (
        COALESCE((SELECT SUM(pg_column_size(feed))::bigint FROM "orphanFeeds" AS feed), 0)
        + COALESCE((SELECT SUM(pg_column_size(article))::bigint FROM "orphanArticles" AS article), 0)
      )::bigint AS "estimatedStoredBytes",
      (SELECT MIN("createdAt") FROM "orphanFeeds") AS "oldestOrphanSourceCreatedAt",
      (
        SELECT COUNT(*)::bigint
        FROM "ArticleCollectionItem" AS item
        INNER JOIN "orphanArticles" AS article ON article."id" = item."articleId"
      ) AS "collectionItems",
      (
        SELECT COUNT(*)::bigint
        FROM "DiscoverFeed" AS directory
        INNER JOIN "orphanFeeds" AS feed ON feed."feedUrl" = directory."url"
      ) AS "dynamicDirectoryEntries",
      (
        SELECT COUNT(*)::bigint
        FROM "orphanFeeds" AS feed
        WHERE feed."feedUrl" IN (${Prisma.join(staticDirectoryUrls)})
      ) AS "staticDirectoryEntries",
      (
        SELECT COUNT(*)::bigint
        FROM "ChatRoomFeed" AS room_feed
        INNER JOIN "orphanFeeds" AS feed ON feed."id" = room_feed."feedId"
      ) AS "chatRoomFeeds",
      (
        SELECT COUNT(*)::bigint
        FROM "ChatBotDelivery" AS delivery
        INNER JOIN "orphanFeeds" AS feed ON feed."id" = delivery."feedId"
      ) AS "chatBotDeliveries",
      (
        SELECT COUNT(*)::bigint
        FROM "ChatMessage" AS message
        INNER JOIN "orphanArticles" AS article ON article."id" = message."articleId"
      ) AS "chatMessageReferences",
      (
        SELECT COUNT(*)::bigint
        FROM "ChatAuditLog" AS audit
        INNER JOIN "ChatMessage" AS message ON message."id" = audit."messageId"
        INNER JOIN "orphanArticles" AS article ON article."id" = message."articleId"
      ) AS "auditLogReferences",
      (
        SELECT COUNT(*)::bigint
        FROM "ChatLegalHold" AS legal_hold
        INNER JOIN "ChatMessage" AS message
          ON legal_hold."subjectType" = 'CHAT_MESSAGE'
          AND legal_hold."subjectId" = message."id"
        INNER JOIN "orphanArticles" AS article ON article."id" = message."articleId"
        WHERE legal_hold."releasedAt" IS NULL
      ) AS "activeChatLegalHolds",
      (
        SELECT COUNT(*)::bigint
        FROM "ArticleState" AS state
        INNER JOIN "orphanArticles" AS article ON article."id" = state."articleId"
      ) AS "articleStates",
      (
        SELECT COUNT(*)::bigint
        FROM "ArticleAiSummary" AS summary
        INNER JOIN "orphanArticles" AS article ON article."id" = summary."articleId"
      ) AS "articleAiSummaries",
      (
        SELECT COUNT(*)::bigint
        FROM "AiDigestItem" AS digest_item
        INNER JOIN "orphanArticles" AS article ON article."id" = digest_item."articleId"
      ) AS "aiDigestItems",
      (
        SELECT COUNT(*)::bigint
        FROM "SmartDigestItem" AS digest_item
        INNER JOIN "orphanArticles" AS article ON article."id" = digest_item."articleId"
      ) AS "smartDigestItems",
      (
        SELECT COUNT(*)::bigint
        FROM "StoryClusterMember" AS member
        INNER JOIN "orphanArticles" AS article ON article."id" = member."articleId"
      ) AS "storyClusterMembers"
  `
}

const podcastOrphanReportQuery = Prisma.sql`
  WITH "orphanPodcasts" AS (
    SELECT podcast.*
    FROM "Podcast" AS podcast
    WHERE NOT EXISTS (
      SELECT 1
      FROM "PodcastSubscription" AS subscription
      WHERE subscription."podcastId" = podcast."id"
    )
  ),
  "orphanEpisodes" AS (
    SELECT episode.*
    FROM "PodcastEpisode" AS episode
    INNER JOIN "orphanPodcasts" AS podcast ON podcast."id" = episode."podcastId"
  )
  SELECT
    (SELECT COUNT(*)::bigint FROM "orphanPodcasts") AS "orphanSourceCount",
    (SELECT COUNT(*)::bigint FROM "orphanEpisodes") AS "episodeCount",
    (
      COALESCE((SELECT SUM(pg_column_size(podcast))::bigint FROM "orphanPodcasts" AS podcast), 0)
      + COALESCE((SELECT SUM(pg_column_size(episode))::bigint FROM "orphanEpisodes" AS episode), 0)
    )::bigint AS "estimatedStoredBytes",
    (SELECT MIN("createdAt") FROM "orphanPodcasts") AS "oldestOrphanSourceCreatedAt",
    (
      SELECT COUNT(*)::bigint
      FROM "ArticleCollectionItem" AS item
      INNER JOIN "orphanEpisodes" AS episode ON episode."id" = item."podcastEpisodeId"
    ) AS "collectionItems",
    (
      SELECT COUNT(*)::bigint
      FROM "PodcastEpisodeState" AS state
      INNER JOIN "orphanEpisodes" AS episode ON episode."id" = state."episodeId"
    ) AS "episodeStates"
`

function mapFeedSummary(row: FeedReportRow): SourceOrphanSummary<FeedOrphanReferences> {
  return {
    estimatedStoredBytes: bytes(row.estimatedStoredBytes),
    itemCount: count(row.articleCount),
    oldestOrphanSourceCreatedAt: timestamp(row.oldestOrphanSourceCreatedAt),
    orphanSourceCount: count(row.orphanSourceCount),
    references: {
      activeChatLegalHolds: count(row.activeChatLegalHolds),
      aiDigestItems: count(row.aiDigestItems),
      articleAiSummaries: count(row.articleAiSummaries),
      articleStates: count(row.articleStates),
      auditLogReferences: count(row.auditLogReferences),
      chatBotDeliveries: count(row.chatBotDeliveries),
      chatMessageReferences: count(row.chatMessageReferences),
      chatRoomFeeds: count(row.chatRoomFeeds),
      collectionItems: count(row.collectionItems),
      dynamicDirectoryEntries: count(row.dynamicDirectoryEntries),
      smartDigestItems: count(row.smartDigestItems),
      staticDirectoryEntries: count(row.staticDirectoryEntries),
      storyClusterMembers: count(row.storyClusterMembers),
    },
  }
}

function mapPodcastSummary(
  row: PodcastReportRow
): SourceOrphanSummary<PodcastOrphanReferences> {
  return {
    estimatedStoredBytes: bytes(row.estimatedStoredBytes),
    itemCount: count(row.episodeCount),
    oldestOrphanSourceCreatedAt: timestamp(row.oldestOrphanSourceCreatedAt),
    orphanSourceCount: count(row.orphanSourceCount),
    references: {
      collectionItems: count(row.collectionItems),
      episodeStates: count(row.episodeStates),
    },
  }
}

function singleRow<Row>(rows: Row[], sourceType: string) {
  if (rows.length !== 1) {
    throw new Error(`Expected exactly one ${sourceType} orphan-retention report row.`)
  }

  return rows[0]
}

function count(value: bigint | number | string) {
  const parsed = BigInt(value)

  if (parsed < 0 || parsed > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Orphan-retention count is outside the supported range.")
  }

  return Number(parsed)
}

function bytes(value: bigint | number | string) {
  const parsed = BigInt(value)

  if (parsed < 0) {
    throw new Error("Orphan-retention byte estimate cannot be negative.")
  }

  return parsed.toString()
}

function timestamp(value: Date | string | null) {
  if (value === null) {
    return null
  }

  const parsed = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Orphan-retention report contains an invalid source timestamp.")
  }

  return parsed.toISOString()
}

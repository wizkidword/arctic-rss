import { type ArticleSearchFilters, type ArticleSearchState } from "./article-search"
import { getPrisma } from "./db"

const MAX_MONITOR_MATCH_BATCH_SIZE = 500

export type SavedMonitorArticleCursor = {
  articleId: string
  createdAt: Date
}

export type SavedMonitorArticleMatch = SavedMonitorArticleCursor

type SavedMonitorMatchingStore = {
  $queryRaw<T>(
    query: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T>
}

// A monitor intentionally counts newly ingested matching articles. It does
// not retroactively count an old article when a reader later changes its read,
// starred, folder, or collection state; that broader automation behavior needs
// a separate, explicitly versioned event model.
export async function listSavedMonitorArticleMatches({
  cursor,
  filters,
  limit,
  store = getPrisma() as unknown as SavedMonitorMatchingStore,
  userId,
}: {
  cursor: SavedMonitorArticleCursor
  filters: ArticleSearchFilters
  limit: number
  store?: SavedMonitorMatchingStore
  userId: string
}): Promise<SavedMonitorArticleMatch[]> {
  const query = filters.query.trim().replace(/\s+/g, " ")

  if (!query) {
    return []
  }

  const state = normalizeSearchState(filters.state)
  const sourcePattern = `%${escapeLikeTerm(query)}%`
  const boundedLimit = Math.min(
    MAX_MONITOR_MATCH_BATCH_SIZE,
    Math.max(1, Math.round(limit))
  )

  return store.$queryRaw<SavedMonitorArticleMatch[]>`
    WITH search_terms AS (
      SELECT websearch_to_tsquery('simple'::regconfig, ${query}) AS "terms"
    )
    SELECT
      "Article"."id" AS "articleId",
      "Article"."createdAt" AS "createdAt"
    FROM "Article"
    INNER JOIN "FeedSubscription"
      ON "FeedSubscription"."feedId" = "Article"."feedId"
    INNER JOIN "Feed"
      ON "Feed"."id" = "Article"."feedId"
    LEFT JOIN "Folder"
      ON "Folder"."id" = "FeedSubscription"."folderId"
      AND "Folder"."userId" = "FeedSubscription"."userId"
    LEFT JOIN "ArticleState"
      ON "ArticleState"."articleId" = "Article"."id"
      AND "ArticleState"."userId" = ${userId}
    CROSS JOIN search_terms
    WHERE "FeedSubscription"."userId" = ${userId}
      AND "FeedSubscription"."isPaused" = false
      AND "ArticleState"."archivedAt" IS NULL
      AND (${filters.subscriptionId ?? null}::text IS NULL OR "FeedSubscription"."id" = ${filters.subscriptionId ?? null})
      AND (${filters.folderId ?? null}::text IS NULL OR "FeedSubscription"."folderId" = ${filters.folderId ?? null})
      AND (${filters.publishedAfter ?? null}::timestamp IS NULL OR "Article"."publishedAt" >= ${filters.publishedAfter ?? null})
      AND (${filters.publishedBefore ?? null}::timestamp IS NULL OR "Article"."publishedAt" < ${filters.publishedBefore ?? null})
      AND (
        ${filters.collectionId ?? null}::text IS NULL
        OR EXISTS (
          SELECT 1
          FROM "ArticleCollectionItem"
          INNER JOIN "ArticleCollection"
            ON "ArticleCollection"."id" = "ArticleCollectionItem"."collectionId"
          WHERE "ArticleCollectionItem"."articleId" = "Article"."id"
            AND "ArticleCollectionItem"."collectionId" = ${filters.collectionId ?? null}
            AND "ArticleCollection"."userId" = ${userId}
        )
      )
      AND (
        ${state} = 'all'
        OR (${state} = 'unread' AND COALESCE("ArticleState"."isRead", false) = false)
        OR (${state} = 'read' AND "ArticleState"."isRead" = true)
        OR (${state} = 'starred' AND "ArticleState"."isStarred" = true)
      )
      AND (
        (
          setweight(to_tsvector('simple'::regconfig, coalesce("Article"."title", '')), 'A')
          || setweight(to_tsvector('simple'::regconfig, coalesce("Article"."author", '')), 'B')
          || setweight(to_tsvector('simple'::regconfig, coalesce("Article"."summary", '')), 'C')
          || setweight(to_tsvector('simple'::regconfig, coalesce("Article"."contentText", '')), 'D')
        ) @@ search_terms."terms"
        OR "Feed"."title" ILIKE ${sourcePattern}
        OR COALESCE("FeedSubscription"."customTitle", '') ILIKE ${sourcePattern}
        OR COALESCE("Folder"."name", '') ILIKE ${sourcePattern}
      )
      AND (
        "Article"."createdAt" > ${cursor.createdAt}
        OR (
          "Article"."createdAt" = ${cursor.createdAt}
          AND "Article"."id" > ${cursor.articleId}
        )
      )
    ORDER BY "Article"."createdAt" ASC, "Article"."id" ASC
    LIMIT ${boundedLimit}
  `
}

function normalizeSearchState(value: string): ArticleSearchState {
  return value === "read" || value === "starred" || value === "unread"
    ? value
    : "all"
}

function escapeLikeTerm(value: string) {
  return value.replace(/[\\%_]/g, "\\$&")
}

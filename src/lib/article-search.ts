import { pageSize } from "./time-cursor"
import {
  listReaderArticlesByIdsForUserWithClient,
  type ReaderArticle,
} from "./articles"
import { getPrisma } from "./db"

export const ARTICLE_SEARCH_QUERY_VERSION = 1
const MAX_SEARCH_QUERY_LENGTH = 200

export type ArticleSearchState = "all" | "read" | "starred" | "unread"

export type ArticleSearchFilters = {
  after?: string
  collectionId?: string
  folderId?: string
  publishedAfter?: Date
  publishedBefore?: Date
  query: string
  state: ArticleSearchState
  subscriptionId?: string
}

export type ArticleSearchParams = Record<
  string,
  string | string[] | undefined
>

export type ReaderArticleSearchPage = {
  articles: ReaderArticle[]
  nextCursor: string | null
}

type ArticleSearchRow = {
  createdAt: Date
  id: string
  publishedAt: Date | null
  rank: number
}

type ReaderArticleSearchStore = Parameters<
  typeof listReaderArticlesByIdsForUserWithClient
>[0]["store"] & {
  $queryRaw<T>(
    query: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T>
}

type ArticleSearchCursor = {
  createdAt: Date
  id: string
  publishedAt: Date | null
  rank: number
}

export function parseArticleSearchFilters(
  params: ArticleSearchParams
): ArticleSearchFilters {
  const publishedAfter = parseCalendarDate(firstSearchParam(params.from))
  const publishedTo = parseCalendarDate(firstSearchParam(params.to))

  return {
    after: firstSearchParam(params.after),
    collectionId: normalizeIdentifier(firstSearchParam(params.collection)),
    folderId: normalizeIdentifier(firstSearchParam(params.folder)),
    publishedAfter: publishedAfter ?? undefined,
    publishedBefore: publishedTo
      ? new Date(publishedTo.getTime() + 24 * 60 * 60 * 1000)
      : undefined,
    query: normalizeSearchQuery(firstSearchParam(params.q)),
    state: normalizeSearchState(firstSearchParam(params.state)),
    subscriptionId: normalizeIdentifier(firstSearchParam(params.source)),
  }
}

export function articleSearchHref(
  filters: ArticleSearchFilters,
  options: {
    after?: string
    articleId?: string
  } = {}
) {
  const params = new URLSearchParams()

  params.set("v", String(ARTICLE_SEARCH_QUERY_VERSION))

  if (filters.query) {
    params.set("q", filters.query)
  }

  if (filters.subscriptionId) {
    params.set("source", filters.subscriptionId)
  }

  if (filters.folderId) {
    params.set("folder", filters.folderId)
  }

  if (filters.collectionId) {
    params.set("collection", filters.collectionId)
  }

  if (filters.state !== "all") {
    params.set("state", filters.state)
  }

  if (filters.publishedAfter) {
    params.set("from", calendarDateValue(filters.publishedAfter))
  }

  if (filters.publishedBefore) {
    params.set(
      "to",
      calendarDateValue(
        new Date(filters.publishedBefore.getTime() - 24 * 60 * 60 * 1000)
      )
    )
  }

  if (options.after) {
    params.set("after", options.after)
  }

  if (options.articleId) {
    params.set("articleId", options.articleId)
  }

  return `/app/search?${params.toString()}`
}

export async function listReaderArticleSearchPage({
  filters,
  limit = 50,
  userId,
}: {
  filters: ArticleSearchFilters
  limit?: number
  userId: string
}): Promise<ReaderArticleSearchPage> {
  return listReaderArticleSearchPageWithClient({
    filters,
    limit,
    store: getPrisma(),
    userId,
  })
}

export async function listReaderArticleSearchPageWithClient({
  filters,
  limit = 50,
  store,
  userId,
}: {
  filters: ArticleSearchFilters
  limit?: number
  store: ReaderArticleSearchStore
  userId: string
}): Promise<ReaderArticleSearchPage> {
  const query = normalizeSearchQuery(filters.query)

  if (!query) {
    return { articles: [], nextCursor: null }
  }

  const boundedLimit = pageSize(limit)
  const cursor = decodeArticleSearchCursor(filters.after)
  const state = normalizeSearchState(filters.state)
  const sourcePattern = `%${escapeLikeTerm(query)}%`
  const rows = await store.$queryRaw<ArticleSearchRow[]>`
    WITH search_terms AS (
      SELECT websearch_to_tsquery('simple'::regconfig, ${query}) AS "terms"
    ),
    ranked_articles AS (
      SELECT
        "Article"."id" AS "id",
        "Article"."createdAt" AS "createdAt",
        "Article"."publishedAt" AS "publishedAt",
        (
          ts_rank_cd(
            setweight(to_tsvector('simple'::regconfig, coalesce("Article"."title", '')), 'A')
            || setweight(to_tsvector('simple'::regconfig, coalesce("Article"."author", '')), 'B')
            || setweight(to_tsvector('simple'::regconfig, coalesce("Article"."summary", '')), 'C')
            || setweight(to_tsvector('simple'::regconfig, coalesce("Article"."contentText", '')), 'D'),
            search_terms."terms",
            32
          )
          + CASE
              WHEN "Feed"."title" ILIKE ${sourcePattern} THEN 0.35
              WHEN COALESCE("FeedSubscription"."customTitle", '') ILIKE ${sourcePattern} THEN 0.35
              WHEN COALESCE("Folder"."name", '') ILIKE ${sourcePattern} THEN 0.25
              ELSE 0
            END
        )::double precision AS "rank"
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
    )
    SELECT "id", "createdAt", "publishedAt", "rank"
    FROM ranked_articles
    WHERE ${cursor?.rank ?? null}::double precision IS NULL
      OR "rank" < ${cursor?.rank ?? null}
      OR (
        "rank" = ${cursor?.rank ?? null}
        AND (
          (
            ${cursor?.publishedAt ?? null}::timestamp IS NOT NULL
            AND (
              "publishedAt" < ${cursor?.publishedAt ?? null}
              OR "publishedAt" IS NULL
              OR (
                "publishedAt" = ${cursor?.publishedAt ?? null}
                AND (
                  "createdAt" < ${cursor?.createdAt ?? null}
                  OR (
                    "createdAt" = ${cursor?.createdAt ?? null}
                    AND "id" < ${cursor?.id ?? null}
                  )
                )
              )
            )
          )
          OR (
            ${cursor?.publishedAt ?? null}::timestamp IS NULL
            AND "publishedAt" IS NULL
            AND (
              "createdAt" < ${cursor?.createdAt ?? null}
              OR (
                "createdAt" = ${cursor?.createdAt ?? null}
                AND "id" < ${cursor?.id ?? null}
              )
            )
          )
        )
      )
    ORDER BY "rank" DESC, "publishedAt" DESC NULLS LAST, "createdAt" DESC, "id" DESC
    LIMIT ${boundedLimit + 1}
  `
  const visibleRows = rows.slice(0, boundedLimit)
  const articles = await listReaderArticlesByIdsForUserWithClient({
    articleIds: visibleRows.map((row) => row.id),
    store,
    userId,
  })

  return {
    articles,
    nextCursor:
      rows.length > boundedLimit && visibleRows.length
        ? encodeArticleSearchCursor(visibleRows.at(-1)!)
        : null,
  }
}

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function normalizeIdentifier(value: string | undefined) {
  const normalized = value?.trim()

  return normalized && normalized.length <= 128 ? normalized : undefined
}

function normalizeSearchQuery(value: string | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_SEARCH_QUERY_LENGTH)
}

function normalizeSearchState(value: string | undefined): ArticleSearchState {
  return value === "read" || value === "starred" || value === "unread"
    ? value
    : "all"
}

function parseCalendarDate(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null
  }

  const date = new Date(`${value}T00:00:00.000Z`)

  return Number.isNaN(date.getTime()) || calendarDateValue(date) !== value
    ? null
    : date
}

function calendarDateValue(value: Date) {
  return value.toISOString().slice(0, 10)
}

function escapeLikeTerm(value: string) {
  return value.replace(/[\\%_]/g, "\\$&")
}

function encodeArticleSearchCursor(cursor: ArticleSearchRow) {
  return Buffer.from(
    JSON.stringify({
      c: cursor.createdAt.toISOString(),
      i: cursor.id,
      p: cursor.publishedAt?.toISOString() ?? null,
      r: cursor.rank,
      v: ARTICLE_SEARCH_QUERY_VERSION,
    })
  ).toString("base64url")
}

function decodeArticleSearchCursor(
  value: string | undefined
): ArticleSearchCursor | null {
  if (!value || value.length > 512) {
    return null
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"))

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      parsed.v !== ARTICLE_SEARCH_QUERY_VERSION ||
      typeof parsed.c !== "string" ||
      typeof parsed.i !== "string" ||
      !/^[a-zA-Z0-9_-]{1,128}$/.test(parsed.i) ||
      (parsed.p !== null && typeof parsed.p !== "string") ||
      typeof parsed.r !== "number" ||
      !Number.isFinite(parsed.r)
    ) {
      return null
    }

    const createdAt = new Date(parsed.c)
    const publishedAt = parsed.p === null ? null : new Date(parsed.p)

    if (
      Number.isNaN(createdAt.getTime()) ||
      (publishedAt && Number.isNaN(publishedAt.getTime()))
    ) {
      return null
    }

    return { createdAt, id: parsed.i, publishedAt, rank: parsed.r }
  } catch {
    return null
  }
}

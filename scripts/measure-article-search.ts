import { randomUUID } from "node:crypto"
import { performance } from "node:perf_hooks"
import { pathToFileURL } from "node:url"

import { Prisma } from "../src/generated/prisma/client"
import { getPrisma } from "../src/lib/db"

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "[::1]", "localhost"])
const DEFAULT_ARTICLE_COUNT = 30_000
const DEFAULT_SAMPLE_COUNT = 15
const DEFAULT_MAX_P95_MS = 350

type SearchVectorMode = "expression" | "stored"

export type ArticleSearchBenchmarkConfig = {
  articleCount: number
  maxP95Ms: number
  sampleCount: number
  vectorMode: SearchVectorMode
}

type PlanNode = {
  "Actual Rows"?: number
  "Index Name"?: string
  "Node Type"?: string
  "Relation Name"?: string
  "Shared Hit Blocks"?: number
  "Shared Read Blocks"?: number
  "Sort Method"?: string
  Plans?: PlanNode[]
}

type ExplainDocument = {
  "Execution Time"?: number
  Plan: PlanNode
}

type PlanSummary = {
  actualRows: number
  executionMs: number
  indexNames: string[]
  nodeTypes: string[]
  sharedHitBlocks: number
  sharedReadBlocks: number
  sortMethods: string[]
}

type SearchScenario = {
  name: string
  publishedAfter?: Date
  publishedBefore?: Date
  query: string
  state: "all" | "starred" | "unread"
}

export function getArticleSearchBenchmarkConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env
): ArticleSearchBenchmarkConfig {
  if (environment.ARCTIC_RSS_SEARCH_BENCHMARK_CONFIRM !== "disposable") {
    throw new Error(
      "Set ARCTIC_RSS_SEARCH_BENCHMARK_CONFIRM=disposable to run the disposable search benchmark."
    )
  }

  if (environment.NODE_ENV === "production") {
    throw new Error("The search benchmark must not run with NODE_ENV=production.")
  }

  const databaseUrl = environment.DATABASE_URL?.trim()
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for the disposable search benchmark.")
  }

  let database: URL
  try {
    database = new URL(databaseUrl)
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL.")
  }

  if (!new Set(["postgres:", "postgresql:"]).has(database.protocol)) {
    throw new Error("DATABASE_URL must use a PostgreSQL URL.")
  }

  if (!LOOPBACK_HOSTS.has(database.hostname.toLowerCase())) {
    throw new Error("The search benchmark accepts loopback PostgreSQL hosts only.")
  }

  return {
    articleCount: parsePositiveInteger(
      environment.ARCTIC_RSS_SEARCH_BENCHMARK_ARTICLES,
      DEFAULT_ARTICLE_COUNT,
      10_000,
      100_000
    ),
    maxP95Ms: parsePositiveInteger(
      environment.ARCTIC_RSS_SEARCH_BENCHMARK_MAX_P95_MS,
      DEFAULT_MAX_P95_MS,
      1,
      60_000
    ),
    sampleCount: parsePositiveInteger(
      environment.ARCTIC_RSS_SEARCH_BENCHMARK_SAMPLES,
      DEFAULT_SAMPLE_COUNT,
      5,
      100
    ),
    vectorMode:
      environment.ARCTIC_RSS_SEARCH_BENCHMARK_VECTOR_MODE === "expression"
        ? "expression"
        : "stored",
  }
}

export function summarizeLatencySamples(samples: number[]) {
  const sorted = [...samples].sort((left, right) => left - right)

  return {
    p50Ms: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    samples: sorted.length,
  }
}

async function runBenchmark(config: ArticleSearchBenchmarkConfig) {
  const prisma = getPrisma()
  const marker = `phase9-${randomUUID().replaceAll("-", "")}`
  const fixture = await seedCorpus({ articleCount: config.articleCount, marker, prisma })

  try {
    await prisma.$executeRaw`ANALYZE "Article"`
    await prisma.$executeRaw`ANALYZE "ArticleState"`
    await prisma.$executeRaw`ANALYZE "Feed"`
    await prisma.$executeRaw`ANALYZE "FeedSubscription"`
    await prisma.$executeRaw`ANALYZE "Folder"`

    const scenarios = [
      { name: "common_term", query: "climate", state: "all" as const },
      { name: "rare_term", query: fixture.rareTerm, state: "all" as const },
      { name: "multi_term", query: "climate research", state: "all" as const },
      { name: "feed_name", query: fixture.feedTerm, state: "all" as const },
      { name: "folder_name", query: fixture.folderTerm, state: "all" as const },
      { name: "unread_filter", query: "climate", state: "unread" as const },
      { name: "high_volume", query: "climate", state: "starred" as const },
      {
        name: "date_range",
        publishedAfter: fixture.dateRangeStart,
        publishedBefore: fixture.dateRangeEnd,
        query: "climate",
        state: "all" as const,
      },
    ]

    const latency = Object.fromEntries(
      await Promise.all(
        scenarios.map(async (scenario) => [
          scenario.name,
          await measureScenario({
            config,
            prisma,
            scenario,
            userId: fixture.userId,
          }),
        ])
      )
    ) as Record<string, ReturnType<typeof summarizeLatencySamples>>
    const plans = await capturePlans({ config, fixture, prisma })
    const p95Passed = Object.values(latency).every(
      (summary) => summary.p95Ms <= config.maxP95Ms
    )
    // A common term can legitimately match most of the corpus, where a
    // sequential scan is cheaper than a bitmap index scan. Prove index health
    // with the selective rare-term case instead of rejecting that valid plan.
    const vectorPlan = plans.rare_term
    const vectorIndex =
      config.vectorMode === "stored"
        ? "Article_searchDocument_idx"
        : "Article_searchDocument_expression_benchmark_idx"
    const vectorIndexUsed = vectorPlan.indexNames.includes(vectorIndex)

    return {
      corpus: {
        articleCount: config.articleCount,
        bodyBytes: 900,
        feeds: fixture.feedCount,
        readerStates: fixture.stateCount,
        subscriptions: fixture.feedCount,
      },
      latency,
      passed: p95Passed && vectorIndexUsed,
      plans,
      target: { maxP95Ms: config.maxP95Ms, vectorIndex },
      vectorMode: config.vectorMode,
    }
  } finally {
    await prisma.feed.deleteMany({ where: { id: { in: fixture.feedIds } } })
    await prisma.user.delete({ where: { id: fixture.userId } })
  }
}

async function seedCorpus({
  articleCount,
  marker,
  prisma,
}: {
  articleCount: number
  marker: string
  prisma: ReturnType<typeof getPrisma>
}) {
  const feedCount = 24
  const userId = `search-benchmark-user-${marker}`
  const feedIds = Array.from({ length: feedCount }, (_, index) => `search-benchmark-feed-${marker}-${index}`)
  const folderIds = Array.from({ length: 6 }, (_, index) => `search-benchmark-folder-${marker}-${index}`)
  const rareTerm = `rare-${marker}`
  const feedTerm = `Benchmark Source ${marker} 0`
  const folderTerm = `Benchmark Folder ${marker} 0`
  const bodyPadding = "analysis reporting evidence context ".repeat(30)

  await prisma.user.create({
    data: { email: `search-benchmark-${marker}@example.test`, id: userId, plan: "PRO" },
  })
  await prisma.folder.createMany({
    data: folderIds.map((id, index) => ({
      id,
      name: `Benchmark Folder ${marker} ${index}`,
      userId,
    })),
  })
  await prisma.feed.createMany({
    data: feedIds.map((id, index) => ({
      feedUrl: `https://search-benchmark.example.test/${marker}/${index}.xml`,
      id,
      title: `Benchmark Feed ${marker} ${index}`,
    })),
  })
  await prisma.feedSubscription.createMany({
    data: feedIds.map((feedId, index) => ({
      customTitle: `Benchmark Source ${marker} ${index}`,
      feedId,
      folderId: folderIds[index % folderIds.length],
      id: `search-benchmark-subscription-${marker}-${index}`,
      userId,
    })),
  })

  const articleIds = Array.from(
    { length: articleCount },
    (_, index) => `search-benchmark-article-${marker}-${index}`
  )
  for (const batch of chunk(articleIds, 1_000)) {
    await prisma.article.createMany({
      data: batch.map((id) => {
        const index = Number(id.slice(id.lastIndexOf("-") + 1))
        const isRare = index === 0

        return {
          contentText: `${isRare ? rareTerm : "climate"} ${bodyPadding}${index}`,
          externalId: `search-benchmark-external-${marker}-${index}`,
          feedId: feedIds[index % feedIds.length]!,
          id,
          publishedAt: new Date(1_700_000_000_000 - index * 60_000),
          summary: "Research evidence from a representative subscription corpus.",
          title: isRare ? `Rare research ${rareTerm}` : `Climate research ${index}`,
          url: `https://search-benchmark.example.test/article/${marker}/${index}`,
        }
      }),
    })
  }

  const stateRows = articleIds.flatMap((articleId, index) =>
    index % 2 === 0
      ? [
          {
            articleId,
            archivedAt: index % 20 === 0 ? new Date("2026-01-01T00:00:00.000Z") : null,
            id: `search-benchmark-state-${marker}-${index}`,
            isRead: index % 4 === 0,
            isStarred: index % 10 === 0,
            userId,
          },
        ]
      : []
  )
  for (const batch of chunk(stateRows, 1_000)) {
    await prisma.articleState.createMany({ data: batch })
  }

  return {
    dateRangeEnd: new Date(1_700_000_000_000 - 7 * 24 * 60 * 60 * 1_000),
    dateRangeStart: new Date(1_700_000_000_000 - 14 * 24 * 60 * 60 * 1_000),
    feedCount,
    feedIds,
    feedTerm,
    folderTerm,
    rareTerm,
    stateCount: stateRows.length,
    userId,
  }
}

async function measureScenario({
  config,
  prisma,
  scenario,
  userId,
}: {
  config: ArticleSearchBenchmarkConfig
  prisma: ReturnType<typeof getPrisma>
  scenario: SearchScenario
  userId: string
}) {
  for (let index = 0; index < 3; index += 1) {
    await runRepresentativeSearch({
      config,
      prisma,
      publishedAfter: scenario.publishedAfter,
      publishedBefore: scenario.publishedBefore,
      query: scenario.query,
      state: scenario.state,
      userId,
    })
  }

  const samples: number[] = []
  for (let index = 0; index < config.sampleCount; index += 1) {
    const startedAt = performance.now()
    await runRepresentativeSearch({
      config,
      prisma,
      publishedAfter: scenario.publishedAfter,
      publishedBefore: scenario.publishedBefore,
      query: scenario.query,
      state: scenario.state,
      userId,
    })
    samples.push(performance.now() - startedAt)
  }

  return summarizeLatencySamples(samples)
}

async function runRepresentativeSearch({
  config,
  prisma,
  publishedAfter,
  publishedBefore,
  query,
  state,
  userId,
}: {
  config: ArticleSearchBenchmarkConfig
  prisma: ReturnType<typeof getPrisma>
  publishedAfter?: Date
  publishedBefore?: Date
  query: string
  state: "all" | "starred" | "unread"
  userId: string
}) {
  const searchDocument = articleSearchDocument(config.vectorMode)
  const sourcePattern = `%${escapeLikeTerm(query)}%`

  await prisma.$queryRaw`
    WITH search_terms AS (
      SELECT websearch_to_tsquery('simple'::regconfig, ${query}) AS "terms"
    )
    SELECT
      "Article"."id",
      (
        ts_rank(${searchDocument}, search_terms."terms", 32)
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
      AND (${publishedAfter ?? null}::timestamp IS NULL OR "Article"."publishedAt" >= ${publishedAfter ?? null})
      AND (${publishedBefore ?? null}::timestamp IS NULL OR "Article"."publishedAt" < ${publishedBefore ?? null})
      AND (
        ${searchDocument} @@ search_terms."terms"
        OR "Feed"."title" ILIKE ${sourcePattern}
        OR COALESCE("FeedSubscription"."customTitle", '') ILIKE ${sourcePattern}
        OR COALESCE("Folder"."name", '') ILIKE ${sourcePattern}
      )
      AND (
        ${state} = 'all'
        OR (${state} = 'unread' AND COALESCE("ArticleState"."isRead", false) = false)
        OR (${state} = 'starred' AND "ArticleState"."isStarred" = true)
      )
    ORDER BY "rank" DESC, "Article"."publishedAt" DESC NULLS LAST, "Article"."id" DESC
    LIMIT 51
  `
}

async function capturePlans({
  config,
  fixture,
  prisma,
}: {
  config: ArticleSearchBenchmarkConfig
  fixture: Awaited<ReturnType<typeof seedCorpus>>
  prisma: ReturnType<typeof getPrisma>
}) {
  const searchDocument = articleSearchDocument(config.vectorMode)
  const sourcePattern = `%${fixture.feedTerm}%`
  const folderPattern = `%${fixture.folderTerm}%`
  const dateRangeSourcePattern = `%climate%`
  const plans = await Promise.all([
    prisma.$queryRaw<Array<{ "QUERY PLAN": unknown }>>`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT "id" FROM "Article"
      WHERE ${searchDocument} @@ websearch_to_tsquery('simple'::regconfig, ${fixture.rareTerm})
    `,
    prisma.$queryRaw<Array<{ "QUERY PLAN": unknown }>>`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT "id" FROM "Article"
      WHERE ${searchDocument} @@ websearch_to_tsquery('simple'::regconfig, ${"climate"})
    `,
    prisma.$queryRaw<Array<{ "QUERY PLAN": unknown }>>`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT "id" FROM "FeedSubscription"
      WHERE "userId" = ${fixture.userId} AND "customTitle" ILIKE ${sourcePattern}
    `,
    prisma.$queryRaw<Array<{ "QUERY PLAN": unknown }>>`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT "id" FROM "Folder"
      WHERE "userId" = ${fixture.userId} AND "name" ILIKE ${folderPattern}
    `,
    prisma.$queryRaw<Array<{ "QUERY PLAN": unknown }>>`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      WITH search_terms AS (
        SELECT websearch_to_tsquery('simple'::regconfig, ${"climate"}) AS "terms"
      )
      SELECT "Article"."id"
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
        AND "ArticleState"."userId" = ${fixture.userId}
      CROSS JOIN search_terms
      WHERE "FeedSubscription"."userId" = ${fixture.userId}
        AND "FeedSubscription"."isPaused" = false
        AND "ArticleState"."archivedAt" IS NULL
        AND "Article"."publishedAt" >= ${fixture.dateRangeStart}
        AND "Article"."publishedAt" < ${fixture.dateRangeEnd}
        AND (
          "Article"."searchDocument" @@ search_terms."terms"
          OR "Feed"."title" ILIKE ${dateRangeSourcePattern}
          OR COALESCE("FeedSubscription"."customTitle", '') ILIKE ${dateRangeSourcePattern}
          OR COALESCE("Folder"."name", '') ILIKE ${dateRangeSourcePattern}
        )
      ORDER BY "Article"."publishedAt" DESC NULLS LAST, "Article"."id" DESC
      LIMIT 51
    `,
  ])

  return {
    date_range: summarizePlan(plans[4]),
    feed_name: summarizePlan(plans[2]),
    folder_name: summarizePlan(plans[3]),
    high_volume: summarizePlan(plans[1]),
    rare_term: summarizePlan(plans[0]),
  }
}

function articleSearchDocument(mode: SearchVectorMode) {
  return mode === "stored"
    ? Prisma.sql`"Article"."searchDocument"`
    : Prisma.sql`setweight(to_tsvector('simple'::regconfig, coalesce("Article"."title", '')), 'A') || setweight(to_tsvector('simple'::regconfig, coalesce("Article"."author", '')), 'B') || setweight(to_tsvector('simple'::regconfig, coalesce("Article"."summary", '')), 'C') || setweight(to_tsvector('simple'::regconfig, coalesce("Article"."contentText", '')), 'D')`
}

function summarizePlan(result: Array<{ "QUERY PLAN": unknown }>): PlanSummary {
  const document = result[0]?.["QUERY PLAN"]
  if (!Array.isArray(document) || !isExplainDocument(document[0])) {
    throw new Error("PostgreSQL did not return a JSON query plan.")
  }

  const nodes = flattenPlan(document[0].Plan)
  return {
    actualRows: document[0].Plan["Actual Rows"] ?? 0,
    executionMs: round(document[0]["Execution Time"] ?? 0),
    indexNames: unique(nodes.map((node) => node["Index Name"]).filter(isString)),
    nodeTypes: unique(nodes.map((node) => node["Node Type"]).filter(isString)),
    sharedHitBlocks: nodes.reduce((total, node) => total + (node["Shared Hit Blocks"] ?? 0), 0),
    sharedReadBlocks: nodes.reduce((total, node) => total + (node["Shared Read Blocks"] ?? 0), 0),
    sortMethods: unique(nodes.map((node) => node["Sort Method"]).filter(isString)),
  }
}

function flattenPlan(plan: PlanNode): PlanNode[] {
  return [plan, ...(plan.Plans?.flatMap(flattenPlan) ?? [])]
}

function isExplainDocument(value: unknown): value is ExplainDocument {
  return typeof value === "object" && value !== null && "Plan" in value
}

function percentile(samples: number[], percentileValue: number) {
  if (!samples.length) {
    return 0
  }

  return round(samples[Math.min(samples.length - 1, Math.ceil(samples.length * percentileValue) - 1)]!)
}

function round(value: number) {
  return Math.round(value * 100) / 100
}

function unique(values: string[]) {
  return [...new Set(values)].sort()
}

function isString(value: unknown): value is string {
  return typeof value === "string"
}

function chunk<T>(values: T[], size: number) {
  const chunks: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size))
  }
  return chunks
}

function escapeLikeTerm(value: string) {
  return value.replace(/[\\%_]/g, "\\$&")
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number
) {
  if (!value?.trim()) {
    return fallback
  }

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`Search benchmark configuration must be an integer from ${minimum} to ${maximum}.`)
  }
  return parsed
}

async function main() {
  const config = getArticleSearchBenchmarkConfig()
  const result = await runBenchmark(config)

  console.log(JSON.stringify({ event: "article_search_benchmark_complete", ...result }))
  if (!result.passed) {
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main()
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : "Article search benchmark failed.")
      process.exitCode = 1
    })
    .finally(async () => {
      await getPrisma().$disconnect()
    })
}

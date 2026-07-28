import { randomUUID } from "node:crypto"
import { afterAll, describe, expect, test } from "vitest"

import { listReaderArticleSearchPage } from "./article-search"
import { getPrisma } from "./db"

const databaseTest = process.env.CI ? test : test.skip

type ExplainPlan = {
  Plan: ExplainPlanNode
}

type ExplainPlanNode = {
  "Index Name"?: string
  "Node Type"?: string
  "Relation Name"?: string
  Plans?: ExplainPlanNode[]
}

function planUsesIndex(plan: ExplainPlanNode, indexName: string): boolean {
  return (
    plan["Index Name"] === indexName ||
    plan.Plans?.some((child) => planUsesIndex(child, indexName)) === true
  )
}

function expectPlanToUseIndex(
  result: Array<{ "QUERY PLAN": unknown }>,
  indexName: string
) {
  const plan = extractExplainPlan(result)

  if (!planUsesIndex(plan, indexName)) {
    throw new Error(
      `PostgreSQL did not choose ${indexName}: ${JSON.stringify(
        summarizePlan(plan)
      )}`
    )
  }
}

function summarizePlan(plan: ExplainPlanNode): ExplainPlanNode {
  return {
    "Index Name": plan["Index Name"],
    "Node Type": plan["Node Type"],
    "Relation Name": plan["Relation Name"],
    Plans: plan.Plans?.map(summarizePlan),
  }
}

function extractExplainPlan(result: Array<{ "QUERY PLAN": unknown }>) {
  const queryPlan = result[0]?.["QUERY PLAN"]

  if (!Array.isArray(queryPlan) || !isExplainPlan(queryPlan[0])) {
    throw new Error("PostgreSQL did not return a JSON query plan.")
  }

  return queryPlan[0].Plan
}

function isExplainPlan(value: unknown): value is ExplainPlan {
  return (
    typeof value === "object" &&
    value !== null &&
    "Plan" in value &&
    typeof value.Plan === "object" &&
    value.Plan !== null
  )
}

describe("article search PostgreSQL integration", () => {
  const userIds: string[] = []
  const feedIds: string[] = []
  let prisma: ReturnType<typeof getPrisma> | null = null

  afterAll(async () => {
    if (!prisma) {
      return
    }

    await prisma.feed.deleteMany({ where: { id: { in: feedIds } } })
    await prisma.user.deleteMany({ where: { id: { in: userIds } } })
  })

  databaseTest(
    "uses the migrated full-text and tenant boundaries for article, source, and folder searches",
    async () => {
      prisma = getPrisma()
      const marker = randomUUID().replaceAll("-", "")
      const articleTerm = `glacialsignal${marker}`
      const sourceTerm = `sourcealias${marker}`
      const folderTerm = `folderlabel${marker}`
      const [reader, otherReader] = await Promise.all([
        prisma.user.create({
          data: { email: `story-search-reader-${marker}@example.test` },
        }),
        prisma.user.create({
          data: { email: `story-search-other-${marker}@example.test` },
        }),
      ])
      userIds.push(reader.id, otherReader.id)
      const [readerFeed, otherFeed, folder] = await Promise.all([
        prisma.feed.create({
          data: {
            feedUrl: `https://example.test/reader-${marker}.xml`,
            title: `Research ${marker}`,
          },
        }),
        prisma.feed.create({
          data: {
            feedUrl: `https://example.test/other-${marker}.xml`,
            title: `Other ${marker}`,
          },
        }),
        prisma.folder.create({
          data: { name: folderTerm, userId: reader.id },
        }),
      ])
      feedIds.push(readerFeed.id, otherFeed.id)
      await Promise.all([
        prisma.feedSubscription.create({
          data: {
            customTitle: sourceTerm,
            feedId: readerFeed.id,
            folderId: folder.id,
            userId: reader.id,
          },
        }),
        prisma.feedSubscription.create({
          data: {
            feedId: otherFeed.id,
            userId: otherReader.id,
          },
        }),
      ])
      const [visibleArticle, archivedArticle] = await Promise.all([
        prisma.article.create({
          data: {
            contentText: `A verified ${articleTerm} article body.`,
            externalId: `visible-${marker}`,
            feedId: readerFeed.id,
            title: "Visible research article",
            url: `https://example.test/visible-${marker}`,
          },
        }),
        prisma.article.create({
          data: {
            contentText: `An archived ${articleTerm} article body.`,
            externalId: `archived-${marker}`,
            feedId: readerFeed.id,
            title: "Archived research article",
            url: `https://example.test/archived-${marker}`,
          },
        }),
      ])
      await prisma.article.create({
        data: {
          contentText: `A different user's ${articleTerm} article body.`,
          externalId: `other-${marker}`,
          feedId: otherFeed.id,
          title: "Other reader article",
          url: `https://example.test/other-${marker}`,
        },
      })
      await prisma.articleState.create({
        data: {
          archivedAt: new Date(),
          articleId: archivedArticle.id,
          isRead: true,
          readAt: new Date(),
          userId: reader.id,
        },
      })

      const [bodySearch, sourceSearch, folderSearch] = await Promise.all([
        listReaderArticleSearchPage({
          filters: { query: articleTerm, state: "all" },
          userId: reader.id,
        }),
        listReaderArticleSearchPage({
          filters: { query: sourceTerm, state: "all" },
          userId: reader.id,
        }),
        listReaderArticleSearchPage({
          filters: { query: folderTerm, state: "all" },
          userId: reader.id,
        }),
      ])

      expect(bodySearch.articles.map((article) => article.id)).toEqual([
        visibleArticle.id,
      ])
      expect(sourceSearch.articles.map((article) => article.id)).toEqual([
        visibleArticle.id,
      ])
      expect(folderSearch.articles.map((article) => article.id)).toEqual([
        visibleArticle.id,
      ])
    }
  )

  databaseTest(
    "records the migrated search query plans for a non-user-data corpus",
    async () => {
      prisma = getPrisma()
      const marker = randomUUID().replaceAll("-", "")
      const bodyTerm = `bodyterm${marker}`
      const feedTerm = `feedtitle${marker}`
      const sourceTerm = `sourcealias${marker}`
      const folderTerm = `folderlabel${marker}`
      const feedPattern = `%${feedTerm}%`
      const sourcePattern = `%${sourceTerm}%`
      const folderPattern = `%${folderTerm}%`
      const articleCorpusSize = 1_000
      const discoveryCorpusSize = 5_000
      const reader = await prisma.user.create({
        // The source corpus is above the real FREE-plan cap; PRO is a valid
        // application plan and keeps this test from bypassing that guard.
        data: {
          email: `story-search-plan-${marker}@example.test`,
          plan: "PRO",
        },
      })
      userIds.push(reader.id)

      const primaryFeedId = `story-search-primary-${marker}`
      const corpusFeedIds = Array.from(
        { length: discoveryCorpusSize },
        (_, index) => `story-search-feed-${marker}-${index}`
      )
      const corpusFolderIds = Array.from(
        { length: discoveryCorpusSize },
        (_, index) => `story-search-folder-${marker}-${index}`
      )
      feedIds.push(primaryFeedId, ...corpusFeedIds)

      await prisma.feed.createMany({
        data: [
          {
            feedUrl: `https://example.test/story-search-primary-${marker}.xml`,
            id: primaryFeedId,
            title: `Research ${feedTerm}`,
          },
          ...corpusFeedIds.map((id, index) => ({
            feedUrl: `https://example.test/story-search-feed-${marker}-${index}.xml`,
            id,
            title: `Background feed ${marker} ${index}`,
          })),
        ],
      })
      await prisma.feedSubscription.createMany({
        data: [
          {
            customTitle: `Primary ${sourceTerm}`,
            feedId: primaryFeedId,
            userId: reader.id,
          },
          ...corpusFeedIds.map((feedId, index) => ({
            customTitle: `Background source ${marker} ${index}`,
            feedId,
            userId: reader.id,
          })),
        ],
      })
      await prisma.folder.createMany({
        data: corpusFolderIds.map((id, index) => ({
          id,
          name:
            index === 0
              ? `Research ${folderTerm}`
              : `Background folder ${marker} ${index}`,
          userId: reader.id,
        })),
      })
      await prisma.article.createMany({
        data: Array.from({ length: articleCorpusSize }, (_, index) => ({
          contentText:
            index === 0
              ? `A selective ${bodyTerm} article body.`
              : `Background article body ${marker} ${index}.`,
          externalId: `story-search-article-${marker}-${index}`,
          feedId: primaryFeedId,
          title:
            index === 0
              ? `Research ${bodyTerm}`
              : `Background article ${marker} ${index}`,
          url: `https://example.test/story-search-article-${marker}-${index}`,
        })),
      })

      await prisma.$executeRaw`ANALYZE "Article"`
      await prisma.$executeRaw`ANALYZE "Feed"`
      await prisma.$executeRaw`ANALYZE "FeedSubscription"`
      await prisma.$executeRaw`ANALYZE "Folder"`

      const [articlePlanResult, feedPlanResult, sourcePlanResult, folderPlanResult] =
        await Promise.all([
          prisma.$queryRaw<Array<{ "QUERY PLAN": unknown }>>`
            EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
            SELECT "id"
            FROM "Article"
            WHERE (
              setweight(to_tsvector('simple'::regconfig, coalesce("title", '')), 'A')
              || setweight(to_tsvector('simple'::regconfig, coalesce("author", '')), 'B')
              || setweight(to_tsvector('simple'::regconfig, coalesce("summary", '')), 'C')
              || setweight(to_tsvector('simple'::regconfig, coalesce("contentText", '')), 'D')
            ) @@ websearch_to_tsquery('simple'::regconfig, ${bodyTerm})
          `,
          prisma.$queryRaw<Array<{ "QUERY PLAN": unknown }>>`
            EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
            SELECT "id"
            FROM "Feed"
            WHERE "title" ILIKE ${feedPattern}
          `,
          prisma.$queryRaw<Array<{ "QUERY PLAN": unknown }>>`
            EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
            SELECT "id"
            FROM "FeedSubscription"
            WHERE "userId" = ${reader.id}
              AND "customTitle" ILIKE ${sourcePattern}
          `,
          prisma.$queryRaw<Array<{ "QUERY PLAN": unknown }>>`
            EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
            SELECT "id"
            FROM "Folder"
            WHERE "userId" = ${reader.id}
              AND "name" ILIKE ${folderPattern}
          `,
        ])

      expectPlanToUseIndex(articlePlanResult, "Article_searchDocument_idx")
      console.info(
        `Story search query-plan evidence: ${JSON.stringify({
          article: summarizePlan(extractExplainPlan(articlePlanResult)),
          feed: summarizePlan(extractExplainPlan(feedPlanResult)),
          folder: summarizePlan(extractExplainPlan(folderPlanResult)),
          source: summarizePlan(extractExplainPlan(sourcePlanResult)),
        })}`
      )
    },
    30_000
  )
})

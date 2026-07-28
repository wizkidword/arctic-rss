import { randomUUID } from "node:crypto"
import { afterAll, describe, expect, test } from "vitest"

import { listReaderArticleSearchPage } from "./article-search"
import { getPrisma } from "./db"

const databaseTest = process.env.CI ? test : test.skip

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
})

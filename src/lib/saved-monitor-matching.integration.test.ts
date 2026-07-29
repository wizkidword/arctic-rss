import { randomUUID } from "node:crypto"
import { afterAll, describe, expect, test } from "vitest"

import { getPrisma } from "./db"
import { listSavedMonitorArticleMatches } from "./saved-monitor-matching"

const databaseTest = process.env.CI ? test : test.skip

describe("saved monitor PostgreSQL matching", () => {
  const feedIds: string[] = []
  const userIds: string[] = []
  let prisma: ReturnType<typeof getPrisma> | null = null

  afterAll(async () => {
    if (!prisma) {
      return
    }

    await prisma.feed.deleteMany({ where: { id: { in: feedIds } } })
    await prisma.user.deleteMany({ where: { id: { in: userIds } } })
  })

  databaseTest(
    "counts only new, readable matches for the monitor owner",
    async () => {
      prisma = getPrisma()
      const marker = randomUUID().replaceAll("-", "")
      const query = `monitorice${marker}`
      const cursor = {
        articleId: "",
        createdAt: new Date("2026-07-29T10:00:00.000Z"),
      }
      const [reader, otherReader] = await Promise.all([
        prisma.user.create({
          data: { email: `saved-monitor-reader-${marker}@example.test` },
        }),
        prisma.user.create({
          data: { email: `saved-monitor-other-${marker}@example.test` },
        }),
      ])
      userIds.push(reader.id, otherReader.id)
      const [readerFeed, otherFeed] = await Promise.all([
        prisma.feed.create({
          data: {
            feedUrl: `https://example.test/saved-monitor-reader-${marker}.xml`,
            title: "Reader feed",
          },
        }),
        prisma.feed.create({
          data: {
            feedUrl: `https://example.test/saved-monitor-other-${marker}.xml`,
            title: "Other feed",
          },
        }),
      ])
      feedIds.push(readerFeed.id, otherFeed.id)
      await Promise.all([
        prisma.feedSubscription.create({
          data: { feedId: readerFeed.id, userId: reader.id },
        }),
        prisma.feedSubscription.create({
          data: { feedId: otherFeed.id, userId: otherReader.id },
        }),
      ])

      const [oldArticle, newArticle, archivedArticle] = await Promise.all([
        prisma.article.create({
          data: {
            contentText: query,
            createdAt: new Date("2026-07-29T09:00:00.000Z"),
            externalId: `old-${marker}`,
            feedId: readerFeed.id,
            title: "Old matching coverage",
            url: `https://example.test/old-${marker}`,
          },
        }),
        prisma.article.create({
          data: {
            contentText: query,
            createdAt: new Date("2026-07-29T11:00:00.000Z"),
            externalId: `new-${marker}`,
            feedId: readerFeed.id,
            title: "New matching coverage",
            url: `https://example.test/new-${marker}`,
          },
        }),
        prisma.article.create({
          data: {
            contentText: query,
            createdAt: new Date("2026-07-29T11:05:00.000Z"),
            externalId: `archived-${marker}`,
            feedId: readerFeed.id,
            title: "Archived matching coverage",
            url: `https://example.test/archived-${marker}`,
          },
        }),
      ])
      await Promise.all([
        prisma.article.create({
          data: {
            contentText: query,
            createdAt: new Date("2026-07-29T11:10:00.000Z"),
            externalId: `other-${marker}`,
            feedId: otherFeed.id,
            title: "Other reader matching coverage",
            url: `https://example.test/other-${marker}`,
          },
        }),
        prisma.articleState.create({
          data: {
            archivedAt: new Date(),
            articleId: archivedArticle.id,
            userId: reader.id,
          },
        }),
      ])

      const matches = await listSavedMonitorArticleMatches({
        cursor,
        filters: { query, state: "all" },
        limit: 10,
        userId: reader.id,
      })

      expect(matches).toEqual([
        {
          articleId: newArticle.id,
          createdAt: newArticle.createdAt,
        },
      ])
      expect(matches.map((match) => match.articleId)).not.toContain(oldArticle.id)
    }
  )
})

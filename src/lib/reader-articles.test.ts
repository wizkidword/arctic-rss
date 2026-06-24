import { describe, expect, it, vi } from "vitest"

const findMany = vi.fn()
const findFirst = vi.fn()

vi.mock("./db", () => ({
  getPrisma: () => ({
    article: {
      findFirst,
      findMany,
    },
  }),
}))

import { getReaderArticleForUser, listReaderArticles } from "./articles"

describe("reader articles", () => {
  it("fetches a single subscribed article for stable detail routes", async () => {
    findFirst.mockResolvedValue({
      aiSummaries: [],
      author: "Ada",
      contentHtml: null,
      contentText: "A detail article body.",
      feed: {
        id: "feed-1",
        title: "Example Feed",
      },
      feedId: "feed-1",
      id: "article-1",
      imageUrl: null,
      publishedAt: null,
      states: [
        {
          isRead: true,
          isStarred: false,
          readAt: null,
          starredAt: null,
        },
      ],
      summary: "Detail summary",
      title: "Detail Article",
      url: "https://example.com/detail",
    })

    const article = await getReaderArticleForUser({
      articleId: "article-1",
      userId: "user-1",
    })

    expect(findFirst).toHaveBeenCalledWith({
      include: expect.any(Object),
      where: {
        AND: [
          {
            feed: {
              subscriptions: {
                some: {
                  isPaused: false,
                  userId: "user-1",
                },
              },
            },
          },
          {
            id: "article-1",
          },
        ],
      },
    })
    expect(article).toMatchObject({
      contentText: "A detail article body.",
      feedTitle: "Example Feed",
      id: "article-1",
      isRead: true,
      title: "Detail Article",
    })
  })

  it("includes the newest AI summary for each article", async () => {
    const createdAt = new Date("2026-06-23T12:00:00.000Z")

    findMany.mockResolvedValue([
      {
        aiSummaries: [
          {
            bulletSummary: ["First point", "Second point"],
            category: "Technology",
            createdAt,
            id: "summary-1",
            keyTakeaway: "Summaries should travel with reader articles.",
            model: "local-extractive-v1",
            provider: "local",
            readingTimeSeconds: 45,
            sentiment: "neutral",
            shortSummary: "A stored article summary.",
            tokenCount: 120,
          },
        ],
        author: null,
        contentHtml: "<p>Hello reader.</p>",
        contentText: null,
        feed: {
          id: "feed-1",
          title: "Example Feed",
        },
        feedId: "feed-1",
        id: "article-1",
        imageUrl: null,
        publishedAt: createdAt,
        states: [],
        summary: null,
        title: "Example Article",
        url: "https://example.com/article",
      },
    ])

    const articles = await listReaderArticles({
      userId: "user-1",
    })

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          aiSummaries: {
            orderBy: {
              createdAt: "desc",
            },
            select: {
              bulletSummary: true,
              category: true,
              id: true,
              keyTakeaway: true,
              model: true,
              provider: true,
              readingTimeSeconds: true,
              sentiment: true,
              shortSummary: true,
              tokenCount: true,
            },
            take: 1,
          },
        }),
      })
    )
    expect(articles[0].aiSummary).toEqual({
      bulletSummary: ["First point", "Second point"],
      category: "Technology",
      id: "summary-1",
      keyTakeaway: "Summaries should travel with reader articles.",
      model: "local-extractive-v1",
      provider: "local",
      readingTimeSeconds: 45,
      sentiment: "neutral",
      shortSummary: "A stored article summary.",
      tokenCount: 120,
    })
  })
})

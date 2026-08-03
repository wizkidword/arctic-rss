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

import {
  getReaderArticleForUser,
  listReaderArticles,
  loadReaderArticleView,
  readerArticlePageLimit,
  RIVER_READER_DETAIL_LIMIT,
} from "./articles"

describe("reader articles", () => {
  it("uses the bounded page size for River and reader display modes", () => {
    expect(
      readerArticlePageLimit({
        defaultView: "RIVER",
        displayMode: "THREE_PANE",
      })
    ).toBe(RIVER_READER_DETAIL_LIMIT)
    expect(
      readerArticlePageLimit({
        defaultView: "CLASSIC",
        displayMode: "READER",
      })
    ).toBe(RIVER_READER_DETAIL_LIMIT)
    expect(
      readerArticlePageLimit({
        defaultView: "CLASSIC",
        displayMode: "THREE_PANE",
      })
    ).toBe(50)
  })

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
          {
            states: {
              none: {
                archivedAt: {
                  not: null,
                },
                userId: "user-1",
              },
            },
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

  it("excludes articles the current user deleted from reader streams", async () => {
    findMany.mockResolvedValue([])

    await listReaderArticles({
      userId: "user-1",
    })

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
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
              states: {
                none: {
                  archivedAt: {
                    not: null,
                  },
                  userId: "user-1",
                },
              },
            },
          ],
        },
      })
    )
  })

  it("lists articles saved into one collection owned by the reader", async () => {
    findMany.mockResolvedValue([])

    await listReaderArticles({
      collectionId: "collection-read-later",
      userId: "user-1",
    })

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {
              collectionItems: {
                some: {
                  collection: {
                    userId: "user-1",
                  },
                  collectionId: "collection-read-later",
                },
              },
            },
            {
              states: {
                none: {
                  archivedAt: {
                    not: null,
                  },
                  userId: "user-1",
                },
              },
            },
          ],
        },
      })
    )
  })

  it("caps River mode detail hydration while preserving an explicit selection", async () => {
    const articleIds = Array.from({ length: 14 }, (_, index) =>
      `article-${index + 1}`
    )
    findMany.mockResolvedValue(
      articleIds.map((id) => createReaderArticleRecord(id))
    )

    const view = await loadReaderArticleView({
      articleIds,
      defaultView: "RIVER",
      displayMode: "THREE_PANE",
      selectedArticleId: "article-14",
      userId: "user-1",
    })

    expect(findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            {
              id: {
                in: [
                  ...articleIds.slice(0, RIVER_READER_DETAIL_LIMIT),
                  "article-14",
                ],
              },
            },
          ]),
        }),
      })
    )
    expect(view.riverArticles).toHaveLength(RIVER_READER_DETAIL_LIMIT + 1)
    expect(view.selectedArticle?.id).toBe("article-14")
  })
})

function createReaderArticleRecord(id: string) {
  return {
    aiSummaries: [],
    author: null,
    contentHtml: `<p>${id}</p>`,
    contentText: null,
    createdAt: new Date("2026-07-03T12:00:00.000Z"),
    feed: {
      faviconUrl: null,
      id: "feed-1",
      title: "Example Feed",
    },
    feedId: "feed-1",
    id,
    imageUrl: null,
    publishedAt: null,
    states: [],
    summary: null,
    title: id,
    url: `https://example.com/${id}`,
  }
}

import { describe, expect, it, vi } from "vitest"

import {
  articleSearchHref,
  listReaderArticleSearchPageWithClient,
  parseArticleSearchFilters,
} from "./article-search"

function createArticleRecord(id: string) {
  return {
    aiSummaries: [],
    author: null,
    contentHtml: null,
    contentText: "Readable article body",
    feed: {
      faviconUrl: null,
      id: "feed-1",
      title: "Science Daily",
    },
    feedId: "feed-1",
    id,
    imageUrl: null,
    publishedAt: new Date("2026-07-02T14:00:00.000Z"),
    states: [],
    summary: "A research summary",
    title: "Sea ice study",
    url: `https://example.com/${id}`,
  }
}

describe("article search filters", () => {
  it("normalizes the versioned, shareable query representation", () => {
    const filters = parseArticleSearchFilters({
      collection: " collection-1 ",
      folder: "folder-1",
      from: "2026-06-01",
      q: "  sea   ice  ",
      source: "source-1",
      state: "starred",
      to: "2026-06-30",
    })

    expect(filters).toMatchObject({
      collectionId: "collection-1",
      folderId: "folder-1",
      query: "sea ice",
      state: "starred",
      subscriptionId: "source-1",
    })
    expect(filters.publishedAfter?.toISOString()).toBe(
      "2026-06-01T00:00:00.000Z"
    )
    expect(filters.publishedBefore?.toISOString()).toBe(
      "2026-07-01T00:00:00.000Z"
    )
    expect(articleSearchHref(filters)).toBe(
      "/app/search?v=1&q=sea+ice&source=source-1&folder=folder-1&collection=collection-1&state=starred&from=2026-06-01&to=2026-06-30"
    )
  })

  it("rejects malformed calendar filters and unknown states", () => {
    expect(
      parseArticleSearchFilters({
        from: "2026-02-31",
        q: "topic",
        state: "everything",
        to: "not-a-date",
      })
    ).toMatchObject({
      publishedAfter: undefined,
      publishedBefore: undefined,
      state: "all",
    })
  })
})

describe("article search query", () => {
  it("binds user input, tenant scope, state, and the second authorization guard", async () => {
    const queryRaw = vi.fn().mockResolvedValue([
      {
        createdAt: new Date("2026-07-02T14:00:00.000Z"),
        id: "article-1",
        publishedAt: new Date("2026-07-02T14:00:00.000Z"),
        rank: 0.9,
      },
    ])
    const findMany = vi.fn().mockResolvedValue([createArticleRecord("article-1")])
    const store = {
      $queryRaw: queryRaw,
      article: { findMany },
    }
    const injectionLikeQuery = "ice%_'; DROP TABLE Article; --"

    const result = await listReaderArticleSearchPageWithClient({
      filters: {
        collectionId: "collection-1",
        folderId: "folder-1",
        publishedAfter: new Date("2026-06-01T00:00:00.000Z"),
        publishedBefore: new Date("2026-07-01T00:00:00.000Z"),
        query: injectionLikeQuery,
        state: "unread",
        subscriptionId: "source-1",
      },
      store: store as never,
      userId: "user-1",
    })
    const [strings, ...values] = queryRaw.mock.calls[0] as [
      TemplateStringsArray,
      ...unknown[],
    ]
    const sql = strings.join("?")

    expect(sql).toContain('"FeedSubscription"."userId" = ?')
    expect(sql).toContain('"FeedSubscription"."isPaused" = false')
    expect(sql).toContain('"ArticleState"."archivedAt" IS NULL')
    expect(sql).toContain('"ArticleCollection"."userId" = ?')
    expect(sql).toContain("to_tsvector('simple'::regconfig")
    expect(sql).toContain("ESCAPE CHR(92)")
    expect(sql).not.toContain(injectionLikeQuery)
    expect(values).toContain(injectionLikeQuery)
    expect(values).toContain("ice\\%\\_'; DROP TABLE Article; --")
    expect(findMany).toHaveBeenCalledWith({
      include: expect.objectContaining({
        states: expect.objectContaining({
          where: { userId: "user-1" },
        }),
      }),
      where: {
        AND: [
          { id: { in: ["article-1"] } },
          {
            states: {
              none: {
                archivedAt: { not: null },
                userId: "user-1",
              },
            },
          },
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
        ],
      },
    })
    expect(result.articles.map((article) => article.id)).toEqual(["article-1"])
  })

  it("does not issue a query until a reader supplies a phrase", async () => {
    const queryRaw = vi.fn()
    const findMany = vi.fn()

    await expect(
      listReaderArticleSearchPageWithClient({
        filters: {
          query: "   ",
          state: "all",
        },
        store: {
          $queryRaw: queryRaw,
          article: { findMany },
        } as never,
        userId: "user-1",
      })
    ).resolves.toEqual({ articles: [], nextCursor: null })

    expect(queryRaw).not.toHaveBeenCalled()
    expect(findMany).not.toHaveBeenCalled()
  })

  it("emits a bounded opaque cursor when another result page exists", async () => {
    const rows = [
      {
        createdAt: new Date("2026-07-03T14:00:00.000Z"),
        id: "article-2",
        publishedAt: new Date("2026-07-03T14:00:00.000Z"),
        rank: 0.9,
      },
      {
        createdAt: new Date("2026-07-02T14:00:00.000Z"),
        id: "article-1",
        publishedAt: new Date("2026-07-02T14:00:00.000Z"),
        rank: 0.8,
      },
    ]
    const store = {
      $queryRaw: vi.fn().mockResolvedValue(rows),
      article: {
        findMany: vi.fn().mockResolvedValue([createArticleRecord("article-2")]),
      },
    }

    const result = await listReaderArticleSearchPageWithClient({
      filters: { query: "sea ice", state: "all" },
      limit: 1,
      store: store as never,
      userId: "user-1",
    })

    expect(result.articles.map((article) => article.id)).toEqual(["article-2"])
    expect(result.nextCursor).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})

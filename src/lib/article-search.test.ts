import { describe, expect, it, vi } from "vitest"

import {
  ARTICLE_SEARCH_SLOW_QUERY_THRESHOLD_MS,
  articleSearchHref,
  listReaderArticleSearchPageWithClient,
  logSlowArticleSearch,
  recordArticleSearchMetrics,
  parseArticleSearchFilters,
  savedSearchCreateHref,
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
    expect(savedSearchCreateHref(filters)).toBe(
      "/app/saved-searches/new?v=1&q=sea+ice&source=source-1&folder=folder-1&collection=collection-1&state=starred&from=2026-06-01&to=2026-06-30"
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
    expect(sql).toContain('"Article"."searchDocument"')
    expect(sql).not.toContain("to_tsvector('simple'::regconfig")
    expect(sql).toContain("ts_rank(")
    expect(sql).not.toContain("ts_rank_cd(")
    expect(sql).toContain('"Feed"."title" ILIKE ?')
    expect(sql).not.toContain(injectionLikeQuery)
    expect(values).toContain(injectionLikeQuery)
    expect(values).toContain("%ice\\%\\_'; DROP TABLE Article; --%")
    expect(findMany).toHaveBeenCalledWith({
      select: expect.objectContaining({
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
    const listProjection = findMany.mock.calls[0]?.[0]?.select

    expect(listProjection).not.toHaveProperty("aiSummaries")
    expect(listProjection).not.toHaveProperty("contentHtml")
    expect(listProjection).not.toHaveProperty("contentText")
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

  it("records a timeout without exposing the search text", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined)
    const timeout = Object.assign(new Error("canceling statement due to statement timeout"), {
      code: "57014",
    })
    const store = {
      $queryRaw: vi.fn().mockRejectedValue(timeout),
      article: { findMany: vi.fn() },
    }

    await expect(
      listReaderArticleSearchPageWithClient({
        filters: { query: "private search phrase", state: "all" },
        store: store as never,
        userId: "user-1",
      })
    ).rejects.toBe(timeout)

    expect(info).toHaveBeenCalledWith(
      expect.stringContaining('"search_timeout_total":1')
    )
    expect(info.mock.calls[0]?.[0]).not.toContain("private search phrase")
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

  it("emits a privacy-safe warning only for slow database searches", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const filters = {
      collectionId: "collection-1",
      query: "private search phrase",
      state: "starred" as const,
      subscriptionId: "subscription-1",
    }

    logSlowArticleSearch({
      durationMs: ARTICLE_SEARCH_SLOW_QUERY_THRESHOLD_MS - 1,
      filters,
      outcome: "completed",
    })
    logSlowArticleSearch({
      durationMs: ARTICLE_SEARCH_SLOW_QUERY_THRESHOLD_MS + 12.6,
      filters,
      outcome: "failed",
    })

    expect(warning).toHaveBeenCalledTimes(1)
    expect(warning).toHaveBeenCalledWith(
      JSON.stringify({
        event: "article_search_slow_query",
        durationMs: ARTICLE_SEARCH_SLOW_QUERY_THRESHOLD_MS + 13,
        hasCollectionFilter: true,
        hasFolderFilter: false,
        hasSourceFilter: true,
        outcome: "failed",
        queryLength: 21,
        state: "starred",
      })
    )
    expect(warning.mock.calls[0]?.[0]).not.toContain("private search phrase")
  })

  it("emits complete privacy-safe metrics without reader or query identifiers", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined)
    const filters = {
      folderId: "folder-private",
      publishedAfter: new Date("2026-08-01T00:00:00.000Z"),
      query: "private search phrase",
      state: "unread" as const,
      subscriptionId: "subscription-private",
    }

    recordArticleSearchMetrics({
      durationMs: 123.7,
      filters,
      outcome: "completed",
      resultsCount: 4,
      timedOut: false,
    })

    expect(info).toHaveBeenCalledWith(
      JSON.stringify({
        event: "article_search_metrics",
        outcome: "completed",
        search_duration_ms: 124,
        search_filter_count: 4,
        search_requests_total: 1,
        search_results_count: 4,
        search_timeout_total: 0,
      })
    )
    expect(info.mock.calls[0]?.[0]).not.toContain("private search phrase")
    expect(info.mock.calls[0]?.[0]).not.toContain("folder-private")
    expect(info.mock.calls[0]?.[0]).not.toContain("subscription-private")
  })
})

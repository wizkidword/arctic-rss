import { describe, expect, it, vi } from "vitest"

import {
  AdminDashboardError,
  getAdminDashboardFeedbackWithClient,
  getAdminDashboardUsersWithClient,
  getAdminDashboardWithClient,
  parseAdminDashboardFilters,
  type AdminDashboardStore,
} from "./admin-dashboard"

function decimal(value: number) {
  return {
    toNumber: () => value,
  }
}

function createAdminStore(): AdminDashboardStore {
  return {
    aiDigest: {
      findMany: vi.fn().mockResolvedValue([
        {
          errorMessage: "Provider timed out while generating the digest.",
          id: "digest-failed",
          updatedAt: new Date("2026-06-24T07:45:00.000Z"),
          user: {
            email: "reader@example.com",
          },
        },
      ]),
    },
    aiUsageLog: {
      aggregate: vi.fn().mockResolvedValue({
        _count: {
          _all: 3,
        },
        _sum: {
          costEstimate: decimal(0.0425),
          inputTokens: 1200,
          outputTokens: 340,
        },
      }),
      findMany: vi.fn().mockResolvedValue([
        {
          action: "DAILY_DIGEST",
          costEstimate: decimal(0.0125),
          createdAt: new Date("2026-06-24T07:30:00.000Z"),
          id: "usage-1",
          inputTokens: 400,
          model: "gpt-test",
          outputTokens: 120,
          provider: "openai",
          user: {
            email: "reader@example.com",
          },
        },
      ]),
      groupBy: vi
        .fn()
        .mockResolvedValueOnce([
          {
            _count: {
              _all: 2,
            },
            _sum: {
              costEstimate: decimal(0.03),
              inputTokens: 900,
              outputTokens: 250,
            },
            action: "ARTICLE_SUMMARY",
          },
          {
            _count: {
              _all: 1,
            },
            _sum: {
              costEstimate: decimal(0.0125),
              inputTokens: 300,
              outputTokens: 90,
            },
            action: "DAILY_DIGEST",
          },
        ])
        .mockResolvedValueOnce([
          {
            _count: {
              _all: 3,
            },
            _sum: {
              costEstimate: decimal(0.0425),
              inputTokens: 1200,
              outputTokens: 340,
            },
            model: "gpt-test",
            provider: "openai",
          },
        ]),
    },
    article: {
      count: vi.fn().mockResolvedValue(420),
    },
    bugReport: {
      findMany: vi.fn().mockResolvedValue([
        {
          contactEmail: "reader@example.com",
          createdAt: new Date("2026-06-24T08:00:00.000Z"),
          description: "The podcast player stopped after I changed routes.",
          id: "bug-1",
          pageUrl: "https://arcticrss.com/app/podcasts",
          status: "NEW",
          title: "Podcast player stops",
          userAgent: "Brave on Windows",
          user: {
            email: "reader@example.com",
          },
        },
      ]),
    },
    featureSuggestion: {
      findMany: vi.fn().mockResolvedValue([
        {
          contactEmail: "reader@example.com",
          createdAt: new Date("2026-06-24T08:05:00.000Z"),
          description: "I want a keyboard shortcut palette for power readers.",
          id: "feature-1",
          pageUrl: "https://arcticrss.com/app",
          status: "NEW",
          title: "Command palette",
          userAgent: "Brave on Windows",
          user: {
            email: "reader@example.com",
          },
        },
      ]),
    },
    feed: {
      count: vi
        .fn()
        .mockResolvedValueOnce(12)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(3),
      findMany: vi.fn().mockResolvedValue([
        {
          _count: {
            subscriptions: 3,
          },
          feedUrl: "https://example.com/feed.xml",
          id: "feed-failed",
          lastError: "HTTP 503 from upstream",
          lastFailedAt: new Date("2026-06-24T07:00:00.000Z"),
          lastSuccessfulFetchAt: new Date("2026-06-23T04:00:00.000Z"),
          title: "Example Feed",
        },
      ]),
    },
    feedSubscription: {
      count: vi.fn().mockResolvedValue(19),
    },
    importJob: {
      findMany: vi.fn().mockResolvedValue([
        {
          errorLog: {
            message: "Two feed URLs could not be imported.",
          },
          id: "import-failed",
          updatedAt: new Date("2026-06-24T06:45:00.000Z"),
          user: {
            email: "reader@example.com",
          },
        },
      ]),
    },
    user: {
      count: vi.fn().mockResolvedValueOnce(8).mockResolvedValueOnce(7),
      findMany: vi.fn().mockResolvedValue([
        {
          _count: {
            subscriptions: 4,
          },
          aiMonthlyLimit: 100,
          aiUsagePeriods: [
            {
              consumedUnits: 17,
              reservedUnits: 0,
            },
          ],
          createdAt: new Date("2026-06-20T12:00:00.000Z"),
          disabledAt: null,
          email: "reader@example.com",
          id: "user-1",
          lastLoginAt: new Date("2026-06-23T09:45:00.000Z"),
          name: "Example Reader",
          plan: "FREE",
          role: "USER",
        },
      ]),
    },
  }
}

describe("admin dashboard aggregation", () => {
  it("bounds activity filters and independent table page numbers", () => {
    const filters = parseAdminDashboardFilters(
      {
        bugReportsPage: "2",
        feedbackSearch: "  Podcast player  ",
        featureSuggestionsPage: "3",
        feedsPage: "4",
        from: "2026-05-01",
        to: "2026-06-24",
        usersPage: "5",
      },
      new Date("2026-06-24T08:15:00.000Z"),
    )

    expect(filters).toMatchObject({
      bugReportsPage: 2,
      feedbackSearch: "Podcast player",
      featureSuggestionsPage: 3,
      feedsPage: 4,
      from: "2026-05-01",
      to: "2026-06-24",
      usersPage: 5,
    })
    expect(filters.activityStart).toEqual(new Date("2026-05-01T00:00:00.000Z"))
    expect(filters.activityEnd).toEqual(new Date("2026-06-25T00:00:00.000Z"))

    expect(
      parseAdminDashboardFilters(
        { feedbackSearch: "x".repeat(121) },
        new Date("2026-06-24T08:15:00.000Z"),
      ).feedbackSearch,
    ).toHaveLength(120)

    const fallback = parseAdminDashboardFilters(
      {
        from: "2024-01-01",
        to: "2026-06-24",
        usersPage: "not-a-page",
      },
      new Date("2026-06-24T08:15:00.000Z"),
    )

    expect(fallback).toMatchObject({
      from: "2026-06-01",
      to: "2026-06-24",
      usersPage: 1,
    })
  })

  it("uses bounded pagination for the user table", async () => {
    const store = createAdminStore()
    const rows = Array.from({ length: 26 }, (_, index) => ({
      _count: { subscriptions: index },
      aiMonthlyLimit: 100,
      aiUsagePeriods: [],
      createdAt: new Date("2026-06-20T12:00:00.000Z"),
      disabledAt: null,
      email: `reader-${index}@example.com`,
      id: `user-${index}`,
      lastLoginAt: null,
      name: null,
      plan: "FREE",
      role: "USER",
    }))
    vi.mocked(store.user.findMany).mockResolvedValue(rows)

    const result = await getAdminDashboardUsersWithClient({
      isAdmin: true,
      now: () => new Date("2026-06-24T08:15:00.000Z"),
      page: 3,
      store,
    })

    expect(store.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 50,
        take: 26,
      }),
    )
    expect(result.users).toHaveLength(25)
    expect(result.pagination).toEqual({
      hasNextPage: true,
      page: 3,
      pageSize: 25,
    })
  })

  it("applies the selected activity range and search to each feedback table", async () => {
    const store = createAdminStore()
    const filters = parseAdminDashboardFilters(
      {
        feedbackSearch: "podcast",
        from: "2026-06-01",
        to: "2026-06-24",
      },
      new Date("2026-06-24T08:15:00.000Z"),
    )

    await getAdminDashboardFeedbackWithClient({
      filters,
      isAdmin: true,
      store,
    })

    const dateRange = {
      gte: new Date("2026-06-01T00:00:00.000Z"),
      lt: new Date("2026-06-25T00:00:00.000Z"),
    }
    const where = {
      OR: [
        { title: { contains: "podcast", mode: "insensitive" } },
        { description: { contains: "podcast", mode: "insensitive" } },
        { contactEmail: { contains: "podcast", mode: "insensitive" } },
        { pageUrl: { contains: "podcast", mode: "insensitive" } },
        { userAgent: { contains: "podcast", mode: "insensitive" } },
        {
          user: {
            is: {
              email: { contains: "podcast", mode: "insensitive" },
            },
          },
        },
      ],
      createdAt: dateRange,
    }
    expect(store.bugReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where }),
    )
    expect(store.featureSuggestion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where }),
    )
  })

  it("requires explicit administrator authorization before querying", async () => {
    const store = createAdminStore()

    await expect(
      getAdminDashboardWithClient({
        isAdmin: false,
        store,
      }),
    ).rejects.toEqual(
      new AdminDashboardError("Administrator access is required."),
    )

    expect(store.user.count).not.toHaveBeenCalled()
  })

  it("maps operational statistics, users, feed health, AI usage, and failures", async () => {
    const store = createAdminStore()
    const now = new Date("2026-06-24T08:15:00.000Z")

    const dashboard = await getAdminDashboardWithClient({
      isAdmin: true,
      now: () => now,
      store,
    })

    expect(store.feed.count).toHaveBeenLastCalledWith({
      where: {
        OR: [
          {
            lastSuccessfulFetchAt: null,
          },
          {
            lastSuccessfulFetchAt: {
              lt: new Date("2026-06-23T08:15:00.000Z"),
            },
          },
        ],
        subscriptions: {
          some: {
            isPaused: false,
          },
        },
      },
    })
    expect(store.aiUsageLog.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          createdAt: {
            gte: new Date("2026-06-01T00:00:00.000Z"),
          },
        },
      }),
    )
    expect(store.bugReport.findMany).toHaveBeenCalledWith({
      orderBy: {
        createdAt: "desc",
      },
      select: {
        contactEmail: true,
        createdAt: true,
        description: true,
        id: true,
        pageUrl: true,
        status: true,
        title: true,
        userAgent: true,
        user: {
          select: {
            email: true,
          },
        },
      },
      take: 50,
    })
    expect(store.featureSuggestion.findMany).toHaveBeenCalledWith({
      orderBy: {
        createdAt: "desc",
      },
      select: {
        contactEmail: true,
        createdAt: true,
        description: true,
        id: true,
        pageUrl: true,
        status: true,
        title: true,
        userAgent: true,
        user: {
          select: {
            email: true,
          },
        },
      },
      take: 50,
    })
    expect(dashboard).toEqual({
      aiUsage: {
        byAction: [
          {
            action: "ARTICLE_SUMMARY",
            costEstimate: 0.03,
            inputTokens: 900,
            outputTokens: 250,
            requestCount: 2,
          },
          {
            action: "DAILY_DIGEST",
            costEstimate: 0.0125,
            inputTokens: 300,
            outputTokens: 90,
            requestCount: 1,
          },
        ],
        byProviderModel: [
          {
            costEstimate: 0.0425,
            inputTokens: 1200,
            model: "gpt-test",
            outputTokens: 340,
            provider: "openai",
            requestCount: 3,
          },
        ],
        costEstimate: 0.0425,
        inputTokens: 1200,
        monthStart: new Date("2026-06-01T00:00:00.000Z"),
        outputTokens: 340,
        recent: [
          {
            action: "DAILY_DIGEST",
            costEstimate: 0.0125,
            createdAt: new Date("2026-06-24T07:30:00.000Z"),
            id: "usage-1",
            inputTokens: 400,
            model: "gpt-test",
            outputTokens: 120,
            provider: "openai",
            userEmail: "reader@example.com",
          },
        ],
        requestCount: 3,
      },
      feedHealth: {
        failingCount: 2,
        failingFeeds: [
          {
            feedUrl: "https://example.com/feed.xml",
            id: "feed-failed",
            lastError: "HTTP 503 from upstream",
            lastFailedAt: new Date("2026-06-24T07:00:00.000Z"),
            lastSuccessfulFetchAt: new Date("2026-06-23T04:00:00.000Z"),
            subscriberCount: 3,
            title: "Example Feed",
          },
        ],
        staleCount: 3,
      },
      generatedAt: now,
      bugReports: [
        {
          contactEmail: "reader@example.com",
          createdAt: new Date("2026-06-24T08:00:00.000Z"),
          description: "The podcast player stopped after I changed routes.",
          id: "bug-1",
          pageUrl: "https://arcticrss.com/app/podcasts",
          status: "NEW",
          title: "Podcast player stops",
          userAgent: "Brave on Windows",
          userEmail: "reader@example.com",
        },
      ],
      featureSuggestions: [
        {
          contactEmail: "reader@example.com",
          createdAt: new Date("2026-06-24T08:05:00.000Z"),
          description: "I want a keyboard shortcut palette for power readers.",
          id: "feature-1",
          pageUrl: "https://arcticrss.com/app",
          status: "NEW",
          title: "Command palette",
          userAgent: "Brave on Windows",
          userEmail: "reader@example.com",
        },
      ],
      overview: {
        activeSubscriptionCount: 19,
        activeUserCount: 7,
        articleCount: 420,
        failingFeedCount: 2,
        feedCount: 12,
        userCount: 8,
      },
      persistedFailures: [
        {
          id: "digest-failed",
          message: "Provider timed out while generating the digest.",
          occurredAt: new Date("2026-06-24T07:45:00.000Z"),
          type: "AI digest",
          userEmail: "reader@example.com",
        },
        {
          id: "import-failed",
          message: "Two feed URLs could not be imported.",
          occurredAt: new Date("2026-06-24T06:45:00.000Z"),
          type: "OPML import",
          userEmail: "reader@example.com",
        },
      ],
      users: [
        {
          aiMonthlyLimit: 100,
          aiMonthlyUsed: 17,
          createdAt: new Date("2026-06-20T12:00:00.000Z"),
          disabledAt: null,
          email: "reader@example.com",
          id: "user-1",
          lastLoginAt: new Date("2026-06-23T09:45:00.000Z"),
          name: "Example Reader",
          plan: "FREE",
          role: "USER",
          subscriptionCount: 4,
        },
      ],
    })
  })

  it("normalizes absent or non-finite AI cost values to zero", async () => {
    const store = createAdminStore()
    vi.mocked(store.aiUsageLog.aggregate).mockResolvedValue({
      _count: {
        _all: 0,
      },
      _sum: {
        costEstimate: {
          toNumber: () => Number.NaN,
        },
        inputTokens: null,
        outputTokens: null,
      },
    })
    vi.mocked(store.aiUsageLog.groupBy)
      .mockReset()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    vi.mocked(store.aiUsageLog.findMany).mockResolvedValue([])

    const dashboard = await getAdminDashboardWithClient({
      isAdmin: true,
      store,
    })

    expect(dashboard.aiUsage).toEqual(
      expect.objectContaining({
        costEstimate: 0,
        inputTokens: 0,
        outputTokens: 0,
        requestCount: 0,
      }),
    )
  })
})

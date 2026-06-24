import { describe, expect, it, vi } from "vitest"

import {
  AdminDashboardError,
  getAdminDashboardWithClient,
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
          aiMonthlyUsed: 17,
          createdAt: new Date("2026-06-20T12:00:00.000Z"),
          disabledAt: null,
          email: "reader@example.com",
          id: "user-1",
          name: "Example Reader",
          plan: "FREE",
          role: "USER",
        },
      ]),
    },
  }
}

describe("admin dashboard aggregation", () => {
  it("requires explicit administrator authorization before querying", async () => {
    const store = createAdminStore()

    await expect(
      getAdminDashboardWithClient({
        isAdmin: false,
        store,
      })
    ).rejects.toEqual(
      new AdminDashboardError("Administrator access is required.")
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
      })
    )
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
      })
    )
  })
})

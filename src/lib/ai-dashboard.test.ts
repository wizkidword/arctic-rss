import { describe, expect, it, vi } from "vitest"

import {
  getAiDashboardWithClient,
  updateAiPreferencesWithClient,
  type AiDashboardStore,
} from "./ai-dashboard"

function createDashboardStore(): AiDashboardStore {
  return {
    article: {
      count: vi.fn().mockResolvedValue(2),
      findMany: vi.fn().mockResolvedValue([
        {
          aiSummaries: [
            {
              shortSummary: "A cached AI summary for the top story.",
            },
          ],
          contentText: "Fallback article body.",
          feed: {
            title: "Example Feed",
          },
          id: "article-1",
          publishedAt: new Date("2026-06-23T10:00:00.000Z"),
          summary: "Article summary",
          title: "Top story",
          url: "https://example.com/top",
        },
        {
          aiSummaries: [],
          contentText: "Second article body.",
          feed: {
            title: "Example Feed",
          },
          id: "article-2",
          publishedAt: new Date("2026-06-23T09:00:00.000Z"),
          summary: "A feed-provided summary.",
          title: "Second story",
          url: "https://example.com/second",
        },
      ]),
    },
    aiDigest: {
      findMany: vi.fn().mockResolvedValue([
        {
          articleCount: 2,
          completedAt: null,
          createdAt: new Date("2026-06-23T11:30:00.000Z"),
          errorMessage: null,
          id: "digest-pending",
          overview: null,
          status: "PROCESSING",
          title: null,
        },
        {
          articleCount: 7,
          completedAt: new Date("2026-06-22T12:05:00.000Z"),
          createdAt: new Date("2026-06-22T12:00:00.000Z"),
          errorMessage: null,
          id: "digest-complete",
          overview: "Seven unread stories across three topics.",
          status: "COMPLETED",
          title: "Arctic digest - 2026-06-22",
        },
      ]),
    },
    articleAiSummary: {
      count: vi.fn().mockResolvedValue(12),
      findMany: vi.fn().mockResolvedValue([
        {
          article: {
            feed: {
              title: "Example Feed",
            },
            id: "article-1",
            title: "Top story",
            url: "https://example.com/top",
          },
          createdAt: new Date("2026-06-23T11:00:00.000Z"),
          id: "summary-1",
          model: "local-extractive-v1",
          provider: "local",
          shortSummary: "A cached AI summary for the top story.",
        },
      ]),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({
        aiMonthlyLimit: 100,
        aiMonthlyUsed: 37,
        settings: {
          aiAutoSummariesEnabled: true,
          dailyDigestEnabled: false,
        },
      }),
    },
    userSettings: {
      upsert: vi.fn().mockResolvedValue({}),
    },
  }
}

describe("AI dashboard", () => {
  it("builds usage, preference, summary, and digest data for a user", async () => {
    const store = createDashboardStore()
    const now = new Date("2026-06-23T12:00:00.000Z")

    const dashboard = await getAiDashboardWithClient({
      now: () => now,
      store,
      userId: "user-1",
    })

    expect(store.user.findUnique).toHaveBeenCalledWith({
      select: {
        aiMonthlyLimit: true,
        aiMonthlyUsed: true,
        settings: {
          select: {
            aiAutoSummariesEnabled: true,
            dailyDigestEnabled: true,
          },
        },
      },
      where: {
        id: "user-1",
      },
    })
    expect(store.article.findMany).toHaveBeenCalledWith(
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
              publishedAt: {
                gte: new Date("2026-06-22T12:00:00.000Z"),
              },
            },
            {
              states: {
                none: {
                  isRead: true,
                  userId: "user-1",
                },
              },
            },
          ],
        },
      })
    )
    expect(dashboard).toEqual({
      activeDigest: {
        articleCount: 2,
        completedAt: null,
        createdAt: new Date("2026-06-23T11:30:00.000Z"),
        errorMessage: null,
        id: "digest-pending",
        overview: null,
        status: "PROCESSING",
        title: null,
      },
      digestArticles: [
        {
          feedTitle: "Example Feed",
          id: "article-1",
          publishedAt: new Date("2026-06-23T10:00:00.000Z"),
          summary: "A cached AI summary for the top story.",
          title: "Top story",
          url: "https://example.com/top",
        },
        {
          feedTitle: "Example Feed",
          id: "article-2",
          publishedAt: new Date("2026-06-23T09:00:00.000Z"),
          summary: "A feed-provided summary.",
          title: "Second story",
          url: "https://example.com/second",
        },
      ],
      digestHistory: [
        {
          articleCount: 2,
          completedAt: null,
          createdAt: new Date("2026-06-23T11:30:00.000Z"),
          errorMessage: null,
          id: "digest-pending",
          overview: null,
          status: "PROCESSING",
          title: null,
        },
        {
          articleCount: 7,
          completedAt: new Date("2026-06-22T12:05:00.000Z"),
          createdAt: new Date("2026-06-22T12:00:00.000Z"),
          errorMessage: null,
          id: "digest-complete",
          overview: "Seven unread stories across three topics.",
          status: "COMPLETED",
          title: "Arctic digest - 2026-06-22",
        },
      ],
      eligibleDigestArticleCount: 2,
      preferences: {
        aiAutoSummariesEnabled: true,
        dailyDigestEnabled: false,
      },
      recentSummaries: [
        {
          articleId: "article-1",
          articleTitle: "Top story",
          createdAt: new Date("2026-06-23T11:00:00.000Z"),
          feedTitle: "Example Feed",
          id: "summary-1",
          model: "local-extractive-v1",
          provider: "local",
          shortSummary: "A cached AI summary for the top story.",
          url: "https://example.com/top",
        },
      ],
      summaryCount: 12,
      usage: {
        monthlyLimit: 100,
        monthlyRemaining: 63,
        monthlyUsed: 37,
        percentUsed: 37,
      },
    })
    expect(store.article.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        states: {
          none: {
            isRead: true,
            userId: "user-1",
          },
        },
      }),
    })
    expect(store.aiDigest.findMany).toHaveBeenCalledWith({
      orderBy: {
        createdAt: "desc",
      },
      select: {
        articleCount: true,
        completedAt: true,
        createdAt: true,
        errorMessage: true,
        id: true,
        overview: true,
        status: true,
        title: true,
      },
      take: 10,
      where: {
        userId: "user-1",
      },
    })
  })

  it("persists AI preference toggles for the current user", async () => {
    const store = createDashboardStore()

    await updateAiPreferencesWithClient({
      aiAutoSummariesEnabled: true,
      dailyDigestEnabled: true,
      store,
      userId: "user-1",
    })

    expect(store.userSettings.upsert).toHaveBeenCalledWith({
      create: {
        aiAutoSummariesEnabled: true,
        dailyDigestEnabled: true,
        defaultView: "CLASSIC",
        fontSize: "MEDIUM",
        markReadOnOpen: true,
        openLinksInNewTab: true,
        theme: "SYSTEM",
        userId: "user-1",
      },
      update: {
        aiAutoSummariesEnabled: true,
        dailyDigestEnabled: true,
      },
      where: {
        userId: "user-1",
      },
    })
  })
})

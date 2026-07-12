import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock("@/components/ui/button", () => ({
  buttonVariants: () => "button",
}))

vi.mock("@/lib/utils", () => ({
  cn: (...values: Array<string | false | null | undefined>) =>
    values.filter(Boolean).join(" "),
}))

vi.mock("@/components/admin-discover-import-form", () => ({
  AdminDiscoverImportForm: () => (
    <form>
      <label htmlFor="country-code">Country code</label>
      <input id="country-code" />
    </form>
  ),
}))

vi.mock("@/components/admin-discover-category-metadata-form", () => ({
  AdminDiscoverCategoryMetadataForm: () => (
    <form>
      <label htmlFor="category-card">Category card</label>
      <input id="category-card" />
    </form>
  ),
}))

vi.mock("@/components/admin-discover-subreddit-form", () => ({
  AdminDiscoverSubredditForm: () => (
    <form>
      <label htmlFor="subreddit-name">Subreddit</label>
      <input id="subreddit-name" />
    </form>
  ),
}))

import { AdminDashboard } from "./admin-dashboard"

const generatedAt = new Date("2026-06-24T08:15:00.000Z")

function dashboardData() {
  return {
    aiUsage: {
      byAction: [
        {
          action: "ARTICLE_SUMMARY",
          costEstimate: 0.03,
          inputTokens: 900,
          outputTokens: 250,
          requestCount: 2,
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
    generatedAt,
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
        type: "AI digest" as const,
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
  }
}

describe("AdminDashboard", () => {
  it("renders operational statistics, users, feed health, AI usage, and failures", () => {
    const markup = renderToStaticMarkup(
      <AdminDashboard
        dashboard={dashboardData()}
        discoverCategories={[
          {
            description: "National and world reporting.",
            iconKey: "general",
            id: "us-general",
            label: "US General",
          },
        ]}
        queues={{
          available: true,
          failedJobs: [
            {
              attemptsMade: 2,
              failedReason: "AI provider unavailable.",
              id: "digest-digest-1",
              jobName: "generate-digest",
              occurredAt: new Date("2026-06-24T07:15:00.000Z"),
              queueName: "AI digest",
            },
          ],
          queues: [
            {
              active: 1,
              delayed: 2,
              failed: 1,
              name: "Feed refresh",
              waiting: 3,
            },
            {
              active: 0,
              delayed: 0,
              failed: 1,
              name: "AI digest",
              waiting: 1,
            },
          ],
        }}
      />
    )

    expect(markup).toContain("Admin Dashboard")
    expect(markup).toContain('href="/app"')
    expect(markup).toContain("8 total")
    expect(markup).toContain("Example Reader")
    expect(markup).toContain("HTTP 503 from upstream")
    expect(markup).toContain("$0.0425")
    expect(markup).toContain("Article summary")
    expect(markup).toContain("AI provider unavailable.")
    expect(markup).toContain("Provider timed out")
    expect(markup).toContain("Bug reports")
    expect(markup).toContain("Podcast player stops")
    expect(markup).toContain("The podcast player stopped after I changed routes.")
    expect(markup).toContain("Feature suggestions")
    expect(markup).toContain("Command palette")
    expect(markup).toContain("I want a keyboard shortcut palette for power readers.")
    expect(markup).toContain("Import OPML into Discover")
    expect(markup).toContain("Country code")
    expect(markup).toContain("Add Subreddit to Discover")
    expect(markup).toContain("Subreddit")
    expect(markup).toContain("Edit Discover Cards")
    expect(markup).toContain("Category card")
  })

  it("renders explicit empty and queue-unavailable states", () => {
    const dashboard = dashboardData()
    dashboard.feedHealth.failingCount = 0
    dashboard.feedHealth.failingFeeds = []
    dashboard.persistedFailures = []
    dashboard.bugReports = []
    dashboard.featureSuggestions = []
    dashboard.aiUsage.byAction = []
    dashboard.aiUsage.byProviderModel = []
    dashboard.aiUsage.recent = []

    const markup = renderToStaticMarkup(
      <AdminDashboard
        dashboard={dashboard}
        discoverCategories={[]}
        queues={{
          available: false,
          error: "Queue status is temporarily unavailable.",
          failedJobs: [],
          queues: [],
        }}
      />
    )

    expect(markup).toContain("No failing feeds")
    expect(markup).toContain("No persisted failures")
    expect(markup).toContain("No bug reports")
    expect(markup).toContain("No feature suggestions")
    expect(markup).toContain("Queue status is temporarily unavailable.")
    expect(markup).toContain("No AI requests this month")
  })
})

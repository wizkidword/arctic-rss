import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getOrCreateUserSettings: vi.fn(),
  getUserFeedSubscription: vi.fn(),
  listArticleCollectionsForUser: vi.fn(),
  listReaderArticlePage: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND")
  }),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`)
  }),
}))

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}))

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}))

vi.mock("@/lib/article-collections", () => ({
  listArticleCollectionsForUser: mocks.listArticleCollectionsForUser,
}))

vi.mock("@/lib/articles", () => ({
  listReaderArticlePage: mocks.listReaderArticlePage,
}))

vi.mock("@/lib/feed-subscriptions", () => ({
  getUserFeedSubscription: mocks.getUserFeedSubscription,
}))

vi.mock("@/lib/preferences", () => ({
  normalizeDefaultView: () => "EXPANDED",
}))

vi.mock("@/lib/user-settings", () => ({
  getOrCreateUserSettings: mocks.getOrCreateUserSettings,
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}))

vi.mock("@/components/feed-refresh-button", () => ({
  FeedRefreshButton: ({ subscriptionId }: { subscriptionId: string }) => (
    <span>Refresh {subscriptionId}</span>
  ),
}))

vi.mock("@/components/feed-unsubscribe-button", () => ({
  FeedUnsubscribeButton: ({
    feedTitle,
    subscriptionId,
  }: {
    feedTitle: string
    subscriptionId: string
  }) => (
    <span>
      Unsubscribe {feedTitle} {subscriptionId}
    </span>
  ),
}))

vi.mock("@/components/reader-surface", () => ({
  ReaderSurface: ({ toolbar }: { toolbar?: React.ReactNode }) => (
    <main>{toolbar}</main>
  ),
}))

import FeedPage from "./page"

describe("FeedPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    mocks.getUserFeedSubscription.mockResolvedValue({
      customTitle: null,
      feed: {
        description: "Feed description",
        feedUrl: "https://example.com/feed.xml",
        lastError: null,
        siteUrl: "https://example.com",
        title: "Example Feed",
      },
      feedId: "feed-1",
      id: "subscription-1",
    })
    mocks.getOrCreateUserSettings.mockResolvedValue({
      defaultView: "EXPANDED",
    })
    mocks.listArticleCollectionsForUser.mockResolvedValue([])
    mocks.listReaderArticlePage.mockResolvedValue({ articles: [], nextCursor: null })
  })

  it("places unsubscribe beside the feed toolbar actions", async () => {
    const markup = renderToStaticMarkup(
      await FeedPage({
        params: Promise.resolve({
          subscriptionId: "subscription-1",
        }),
        searchParams: Promise.resolve({}),
      })
    )

    expect(markup).toContain("Refresh subscription-1")
    expect(markup).toContain("Unsubscribe Example Feed subscription-1")
  })
})

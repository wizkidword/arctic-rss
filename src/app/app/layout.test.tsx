import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  getCurrentBulkReadJobForUser: vi.fn(),
  getOrCreateUserSettings: vi.fn(),
  getPrisma: vi.fn(),
  getReaderCounts: vi.fn(),
  listArticleCollectionsForUser: vi.fn(),
  listDiscoverInterestNavigation: vi.fn(),
  listUserFeedNavigation: vi.fn(),
  listUserFolders: vi.fn(),
  requireFreshUser: vi.fn(),
  withAuthenticatedRequestScope: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`)
  }),
}))

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
}))

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}))

vi.mock("@/lib/authorization", () => ({
  AuthorizationError: class AuthorizationError extends Error {},
  requireFreshUser: mocks.requireFreshUser,
  withAuthenticatedRequestScope: mocks.withAuthenticatedRequestScope,
}))

vi.mock("@/components/app-shell", () => ({
  AppShell: ({
    children,
    discoverInterests,
    displayMode,
    feedSubscriptions,
    showEmailVerificationReminder,
    articleCollections,
    themePreference,
  }: React.PropsWithChildren<{
    articleCollections: Array<{ name: string }>
    discoverInterests: Array<{ label: string }>
    displayMode: string
    feedSubscriptions: Array<Record<string, unknown>>
    showEmailVerificationReminder?: boolean
    themePreference: string
  }>) => (
    <div
      data-article-collections={articleCollections
        .map((collection) => collection.name)
        .join(",")}
      data-discover-interests={discoverInterests
        .map((interest) => interest.label)
        .join(",")}
      data-display-mode={displayMode}
      data-feed-subscription-keys={Object.keys(feedSubscriptions[0] ?? {})
        .sort()
        .join(",")}
      data-show-email-verification-reminder={showEmailVerificationReminder}
      data-theme-preference={themePreference}
    >
      {children}
    </div>
  ),
}))

vi.mock("@/lib/articles", () => ({
  getReaderCounts: mocks.getReaderCounts,
}))

vi.mock("@/lib/bulk-read-jobs", () => ({
  getCurrentBulkReadJobForUser: mocks.getCurrentBulkReadJobForUser,
}))

vi.mock("@/lib/article-collections", () => ({
  listArticleCollectionsForUser: mocks.listArticleCollectionsForUser,
}))

vi.mock("@/lib/db", () => ({
  getPrisma: mocks.getPrisma,
}))

vi.mock("@/lib/feed-subscriptions", () => ({
  listUserFeedNavigation: mocks.listUserFeedNavigation,
}))

vi.mock("@/lib/discover-interests", () => ({
  listDiscoverInterestNavigation: mocks.listDiscoverInterestNavigation,
}))

vi.mock("@/lib/folders", () => ({
  listUserFolders: mocks.listUserFolders,
}))

vi.mock("@/lib/user-settings", () => ({
  getOrCreateUserSettings: mocks.getOrCreateUserSettings,
}))

import AuthenticatedAppLayout from "./layout"

describe("AuthenticatedAppLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.cookies.mockResolvedValue({ get: vi.fn() })
    mocks.withAuthenticatedRequestScope.mockImplementation((callback) =>
      callback({ user: { id: "user-1" } })
    )
  })

  it("passes the saved theme preference into the reader shell", async () => {
    mocks.requireFreshUser.mockResolvedValue({
      emailVerified: new Date("2026-07-02T12:00:00.000Z"),
    })
    mocks.getReaderCounts.mockResolvedValue({
      allCount: 0,
      starredCount: 0,
      unreadCount: 0,
    })
    mocks.getCurrentBulkReadJobForUser.mockResolvedValue(null)
    mocks.listUserFeedNavigation.mockResolvedValue([
      {
        faviconUrl: null,
        feedId: "feed-1",
        folderId: null,
        id: "subscription-1",
        isPaused: false,
        lastError: "must not reach the shell",
        needsAttention: true,
        title: "Example Feed",
        unreadCount: 3,
      },
    ])
    mocks.listUserFolders.mockResolvedValue([])
    mocks.listArticleCollectionsForUser.mockResolvedValue([
      {
        articleCount: 2,
        id: "collection-read-later",
        name: "Read Later",
      },
    ])
    mocks.listDiscoverInterestNavigation.mockResolvedValue([
      {
        feedCount: 42,
        id: "general",
        label: "General",
      },
    ])
    mocks.getOrCreateUserSettings.mockResolvedValue({
      displayMode: "MINIMAL",
      theme: "DARK",
    })

    const markup = renderToStaticMarkup(
      await AuthenticatedAppLayout({
        children: <main>Reader content</main>,
      })
    )

    expect(mocks.getOrCreateUserSettings).toHaveBeenCalledWith("user-1")
    expect(mocks.requireFreshUser).toHaveBeenCalledWith({ user: { id: "user-1" } })
    expect(mocks.listArticleCollectionsForUser).toHaveBeenCalledWith("user-1")
    expect(mocks.listDiscoverInterestNavigation).toHaveBeenCalled()
    expect(markup).toContain('data-theme-preference="DARK"')
    expect(markup).toContain('data-display-mode="MINIMAL"')
    expect(markup).toContain('data-feed-subscription-keys="faviconUrl,feedId,folderId,id,isPaused,needsAttention,title,unreadCount"')
    expect(markup).not.toContain("lastError")
    expect(markup).toContain(
      'data-show-email-verification-reminder="false"'
    )
    expect(markup).toContain('data-article-collections="Read Later"')
    expect(markup).toContain('data-discover-interests="General"')
  })
})

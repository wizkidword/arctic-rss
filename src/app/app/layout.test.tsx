import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getOrCreateUserSettings: vi.fn(),
  getPrisma: vi.fn(),
  getReaderCounts: vi.fn(),
  listArticleCollectionsForUser: vi.fn(),
  listDiscoverInterestNavigation: vi.fn(),
  listUserFeedSubscriptions: vi.fn(),
  listUserFolders: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`)
  }),
}))

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}))

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}))

vi.mock("@/components/app-shell", () => ({
  AppShell: ({
    children,
    discoverInterests,
    displayMode,
    showEmailVerificationReminder,
    articleCollections,
    themePreference,
  }: React.PropsWithChildren<{
    articleCollections: Array<{ name: string }>
    discoverInterests: Array<{ label: string }>
    displayMode: string
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

vi.mock("@/lib/article-collections", () => ({
  listArticleCollectionsForUser: mocks.listArticleCollectionsForUser,
}))

vi.mock("@/lib/db", () => ({
  getPrisma: mocks.getPrisma,
}))

vi.mock("@/lib/feed-subscriptions", () => ({
  listUserFeedSubscriptions: mocks.listUserFeedSubscriptions,
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
  })

  it("passes the saved theme preference into the reader shell", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    mocks.getReaderCounts.mockResolvedValue({
      allCount: 0,
      starredCount: 0,
      unreadCount: 0,
    })
    mocks.listUserFeedSubscriptions.mockResolvedValue([])
    mocks.listUserFolders.mockResolvedValue([])
    mocks.getPrisma.mockReturnValue({
      user: {
        findUnique: vi.fn(async () => ({
          emailVerified: new Date("2026-07-02T12:00:00.000Z"),
        })),
      },
    })
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
    expect(mocks.listArticleCollectionsForUser).toHaveBeenCalledWith("user-1")
    expect(mocks.listDiscoverInterestNavigation).toHaveBeenCalled()
    expect(markup).toContain('data-theme-preference="DARK"')
    expect(markup).toContain('data-display-mode="MINIMAL"')
    expect(markup).toContain(
      'data-show-email-verification-reminder="false"'
    )
    expect(markup).toContain('data-article-collections="Read Later"')
    expect(markup).toContain('data-discover-interests="General"')
  })
})

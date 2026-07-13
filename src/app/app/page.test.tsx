import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getOrCreateUserSettings: vi.fn(),
  hasUserFeedSubscriptions: vi.fn(),
  listArticleCollectionsForUser: vi.fn(),
  listReaderArticlePage: vi.fn(),
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

vi.mock("@/components/reader-surface", () => ({
  ReaderSurface: ({
    description,
    title,
  }: {
    description: string
    title: string
  }) => (
    <main>
      <h1>{title}</h1>
      <p>{description}</p>
    </main>
  ),
}))

vi.mock("@/lib/article-collections", () => ({
  listArticleCollectionsForUser: mocks.listArticleCollectionsForUser,
}))

vi.mock("@/lib/articles", () => ({
  listReaderArticlePage: mocks.listReaderArticlePage,
}))

vi.mock("@/lib/feed-subscriptions", () => ({
  hasUserFeedSubscriptions: mocks.hasUserFeedSubscriptions,
}))

vi.mock("@/lib/user-settings", () => ({
  getOrCreateUserSettings: mocks.getOrCreateUserSettings,
}))

import AppHomePage from "./page"

describe("AppHomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    mocks.getOrCreateUserSettings.mockResolvedValue({
      dateFormat: "DEFAULT",
      defaultView: "CLASSIC",
      displayMode: "THREE_PANE",
      timeFormat: "DEFAULT",
      timeZone: "UTC",
    })
    mocks.hasUserFeedSubscriptions.mockResolvedValue(true)
    mocks.listArticleCollectionsForUser.mockResolvedValue([])
    mocks.listReaderArticlePage.mockResolvedValue({ articles: [], nextCursor: null })
  })

  it("sends first-run readers to Discover until they subscribe to a feed", async () => {
    mocks.hasUserFeedSubscriptions.mockResolvedValue(false)

    await expect(
      AppHomePage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow("REDIRECT:/app/discover")

    expect(mocks.hasUserFeedSubscriptions).toHaveBeenCalledWith("user-1")
    expect(mocks.listReaderArticlePage).not.toHaveBeenCalled()
  })

  it("keeps subscribed readers on the All Articles view", async () => {
    const markup = renderToStaticMarkup(
      await AppHomePage({ searchParams: Promise.resolve({}) })
    )

    expect(markup).toContain("All Articles")
    expect(mocks.hasUserFeedSubscriptions).toHaveBeenCalledWith("user-1")
    expect(mocks.listReaderArticlePage).toHaveBeenCalledWith({
      after: undefined,
      userId: "user-1",
    })
  })
})

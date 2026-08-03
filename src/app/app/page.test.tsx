import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getOrCreateUserSettings: vi.fn(),
  hasUserFeedSubscriptions: vi.fn(),
  listArticleCollectionsForUser: vi.fn(),
  listReaderArticlePage: vi.fn(),
  loadReaderArticleView: vi.fn(),
  listStoryClustersForArticleUser: vi.fn(),
  listStoryClustersForArticlesUser: vi.fn(),
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
    inlineStoryClusters,
    storyClusters,
    title,
  }: {
    description: string
    inlineStoryClusters?: Array<{ id: string }>
    storyClusters?: Array<{ id: string }>
    title: string
  }) => (
    <main>
      <h1>{title}</h1>
      <p>{description}</p>
      <p data-inline-story-clusters={inlineStoryClusters?.length ?? 0} />
      <p data-story-clusters={storyClusters?.length ?? 0} />
    </main>
  ),
}))

vi.mock("@/lib/article-collections", () => ({
  listArticleCollectionsForUser: mocks.listArticleCollectionsForUser,
}))

vi.mock("@/lib/articles", () => ({
  listReaderArticlePage: mocks.listReaderArticlePage,
  loadReaderArticleView: mocks.loadReaderArticleView,
  readerArticlePageLimit: () => 50,
}))

vi.mock("@/lib/feed-subscriptions", () => ({
  hasUserFeedSubscriptions: mocks.hasUserFeedSubscriptions,
}))

vi.mock("@/lib/story-cluster-reader", () => ({
  listStoryClustersForArticleUser: mocks.listStoryClustersForArticleUser,
  listStoryClustersForArticlesUser: mocks.listStoryClustersForArticlesUser,
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
    mocks.loadReaderArticleView.mockImplementation(
      ({ articleIds, selectedArticleId }) => ({
        riverArticles: [],
        selectedArticle: articleIds.includes(selectedArticleId)
          ? { id: selectedArticleId }
          : articleIds[0]
            ? { id: articleIds[0] }
            : null,
      })
    )
    mocks.listStoryClustersForArticleUser.mockResolvedValue([])
    mocks.listStoryClustersForArticlesUser.mockResolvedValue([])
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
      limit: 50,
      userId: "user-1",
    })
  })

  it("loads related coverage for the selected article", async () => {
    mocks.listReaderArticlePage.mockResolvedValue({
      articles: [{ id: "article-1" }, { id: "article-2" }],
      nextCursor: null,
    })
    mocks.listStoryClustersForArticlesUser.mockResolvedValue([
      {
        id: "cluster-1",
        members: [{ articleId: "article-2" }],
      },
    ])
    mocks.listStoryClustersForArticleUser.mockResolvedValue([{ id: "cluster-1" }])

    const markup = renderToStaticMarkup(
      await AppHomePage({
        searchParams: Promise.resolve({ articleId: "article-2" }),
      })
    )

    expect(mocks.listStoryClustersForArticlesUser).toHaveBeenCalledWith({
      articleIds: ["article-1", "article-2"],
      userId: "user-1",
    })
    expect(mocks.listStoryClustersForArticleUser).toHaveBeenCalledWith({
      articleId: "article-2",
      userId: "user-1",
    })
    expect(mocks.loadReaderArticleView).toHaveBeenCalledWith({
      articleIds: ["article-1", "article-2"],
      defaultView: "CLASSIC",
      displayMode: "THREE_PANE",
      selectedArticleId: "article-2",
      userId: "user-1",
    })
    expect(markup).toContain('data-story-clusters="1"')
    expect(markup).toContain('data-inline-story-clusters="1"')
  })
})

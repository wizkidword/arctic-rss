import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getOrCreateUserSettings: vi.fn(),
  listArticleCollectionsForUser: vi.fn(),
  listReaderArticleSearchPage: vi.fn(),
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

vi.mock("@/components/reader-surface", () => ({
  ReaderSurface: ({
    description,
    title,
    toolbar,
  }: {
    description: string
    title: string
    toolbar?: React.ReactNode
  }) => (
    <main>
      <h1>{title}</h1>
      <p>{description}</p>
      <div>{toolbar}</div>
    </main>
  ),
}))

vi.mock("@/lib/article-collections", () => ({
  listArticleCollectionsForUser: mocks.listArticleCollectionsForUser,
}))

vi.mock("@/lib/article-search", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/article-search")>()),
  listReaderArticleSearchPage: mocks.listReaderArticleSearchPage,
}))

vi.mock("@/lib/feed-subscriptions", () => ({
  listUserFeedSubscriptions: mocks.listUserFeedSubscriptions,
}))

vi.mock("@/lib/folders", () => ({
  listUserFolders: mocks.listUserFolders,
}))

vi.mock("@/lib/user-settings", () => ({
  getOrCreateUserSettings: mocks.getOrCreateUserSettings,
}))

import SearchPage from "./page"

describe("SearchPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } })
    mocks.getOrCreateUserSettings.mockResolvedValue({
      dateFormat: "DEFAULT",
      defaultView: "CLASSIC",
      displayMode: "THREE_PANE",
      timeFormat: "DEFAULT",
      timeZone: "UTC",
    })
    mocks.listArticleCollectionsForUser.mockResolvedValue([
      { articleCount: 1, id: "collection-1", name: "Research" },
    ])
    mocks.listReaderArticleSearchPage.mockResolvedValue({
      articles: [],
      nextCursor: null,
    })
    mocks.listUserFeedSubscriptions.mockResolvedValue([
      {
        id: "source-1",
        isPaused: false,
        title: "Science Daily",
      },
      {
        id: "source-2",
        isPaused: true,
        title: "Paused source",
      },
    ])
    mocks.listUserFolders.mockResolvedValue([
      { id: "folder-1", name: "Climate" },
    ])
  })

  it("scopes the query and exposes available reader filters", async () => {
    const markup = renderToStaticMarkup(
      await SearchPage({
        searchParams: Promise.resolve({
          collection: "collection-1",
          folder: "folder-1",
          from: "2026-06-01",
          q: "  ice   sheet  ",
          source: "source-1",
          state: "unread",
          to: "2026-06-30",
        }),
      })
    )

    expect(mocks.listReaderArticleSearchPage).toHaveBeenCalledWith({
      filters: expect.objectContaining({
        collectionId: "collection-1",
        folderId: "folder-1",
        query: "ice sheet",
        state: "unread",
        subscriptionId: "source-1",
      }),
      userId: "user-1",
    })
    expect(markup).toContain("Search articles")
    expect(markup).toContain("Science Daily")
    expect(markup).toContain("Climate")
    expect(markup).toContain("Research")
    expect(markup).not.toContain("Paused source")
  })

  it("redirects anonymous visitors before loading reader data", async () => {
    mocks.auth.mockResolvedValue(null)

    await expect(
      SearchPage({ searchParams: Promise.resolve({ q: "ice" }) })
    ).rejects.toThrow("REDIRECT:/login")

    expect(mocks.listReaderArticleSearchPage).not.toHaveBeenCalled()
  })
})

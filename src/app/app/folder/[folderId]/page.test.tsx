import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getOrCreateUserSettings: vi.fn(),
  getUserFolder: vi.fn(),
  listArticleCollectionsForUser: vi.fn(),
  listReaderArticles: vi.fn(),
  listUserFeedSubscriptions: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND")
  }),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`)
  }),
}))

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}))

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}))

vi.mock("@/components/reader-surface", () => ({
  ReaderSurface: (props: {
    description: string
    title: string
    toolbar?: React.ReactNode
  }) => (
    <main>
      <h1>{props.title}</h1>
      <p>{props.description}</p>
      <div>{props.toolbar}</div>
    </main>
  ),
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
}))

vi.mock("@/components/ui/button", () => ({
  buttonVariants: () => "button-variants",
}))

vi.mock("@/lib/article-collections", () => ({
  listArticleCollectionsForUser: mocks.listArticleCollectionsForUser,
}))

vi.mock("@/lib/articles", () => ({
  listReaderArticles: mocks.listReaderArticles,
}))

vi.mock("@/lib/feed-subscriptions", () => ({
  listUserFeedSubscriptions: mocks.listUserFeedSubscriptions,
}))

vi.mock("@/lib/folders", () => ({
  getUserFolder: mocks.getUserFolder,
}))

vi.mock("@/lib/user-settings", () => ({
  getOrCreateUserSettings: mocks.getOrCreateUserSettings,
}))

import FolderPage from "./page"

describe("FolderPage", () => {
  beforeEach(() => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } })
    mocks.getUserFolder.mockResolvedValue({
      id: "folder-1",
      name: "Science",
      subscriptionCount: 2,
      unreadCount: 7,
    })
    mocks.getOrCreateUserSettings.mockResolvedValue({
      dateFormat: "DEFAULT",
      defaultView: "CLASSIC",
      displayMode: "THREE_PANE",
      timeFormat: "DEFAULT",
      timeZone: "DEFAULT",
    })
    mocks.listReaderArticles.mockResolvedValue([])
    mocks.listArticleCollectionsForUser.mockResolvedValue([])
    mocks.listUserFeedSubscriptions.mockResolvedValue([
      {
        faviconUrl: null,
        feedId: "feed-1",
        feedUrl: "https://example.com/wired.xml",
        folderId: "folder-1",
        folderName: "Science",
        id: "subscription-wired",
        isPaused: false,
        lastError: null,
        siteUrl: null,
        title: "Wired Science",
        unreadCount: 4,
      },
      {
        faviconUrl: null,
        feedId: "feed-2",
        feedUrl: "https://example.com/nasa.xml",
        folderId: "folder-1",
        folderName: "Science",
        id: "subscription-nasa",
        isPaused: false,
        lastError: null,
        siteUrl: null,
        title: "NASA",
        unreadCount: 0,
      },
      {
        faviconUrl: null,
        feedId: "feed-3",
        feedUrl: "https://example.com/politics.xml",
        folderId: "folder-2",
        folderName: "Politics",
        id: "subscription-politics",
        isPaused: false,
        lastError: null,
        siteUrl: null,
        title: "Politics Daily",
        unreadCount: 9,
      },
    ])
  })

  it("lets readers jump from a folder stream to individual feeds in that folder", async () => {
    const markup = renderToStaticMarkup(
      await FolderPage({
        params: Promise.resolve({ folderId: "folder-1" }),
        searchParams: Promise.resolve({}),
      })
    )

    expect(mocks.listUserFeedSubscriptions).toHaveBeenCalledWith("user-1")
    expect(markup).toContain("Feeds in this folder")
    expect(markup).toContain("Combined folder stream")
    expect(markup).toContain('href="/app/folder/folder-1"')
    expect(markup).toContain('href="/app/feed/subscription-wired"')
    expect(markup).toContain("Wired Science")
    expect(markup).toContain("4 unread")
    expect(markup).toContain('href="/app/feed/subscription-nasa"')
    expect(markup).toContain("NASA")
    expect(markup).not.toContain("Politics Daily")
  })
})

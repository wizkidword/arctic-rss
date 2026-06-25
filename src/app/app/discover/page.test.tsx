import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  listUserFeedSubscriptions: vi.fn(),
  listUserFolders: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`)
  }),
}))

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}))

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}))

vi.mock("@/lib/feed-subscriptions", () => ({
  listUserFeedSubscriptions: mocks.listUserFeedSubscriptions,
}))

vi.mock("@/lib/folders", () => ({
  listUserFolders: mocks.listUserFolders,
}))

vi.mock("@/components/feed-directory-subscribe-button", () => ({
  FeedDirectorySubscribeButton: ({
    feedId,
    feedLabel,
    folders,
    subscribed,
  }: {
    feedId: string
    feedLabel: string
    folders: Array<{ id: string; name: string }>
    subscribed: boolean
  }) => (
    <span>
      Directory control: {feedId} | {feedLabel} | subscribed=
      {String(subscribed)} | folders=
      {folders.map((folder) => `${folder.id}:${folder.name}`).join(",")}
    </span>
  ),
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}))

import DiscoverPage from "./page"

describe("DiscoverPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    mocks.listUserFolders.mockResolvedValue([
      {
        id: "folder-1",
        name: "Morning News",
        subscriptionCount: 0,
        unreadCount: 0,
      },
    ])
    mocks.listUserFeedSubscriptions.mockResolvedValue([
      {
        faviconUrl: null,
        feedId: "feed-1",
        feedUrl: "http://www.npr.org/rss/rss.php?id=1003",
        folderId: null,
        folderName: null,
        id: "subscription-1",
        isPaused: false,
        lastError: null,
        siteUrl: "https://www.npr.org",
        title: "NPR - National",
        unreadCount: 0,
      },
    ])
  })

  it("renders the selected category with all feeds and subscription state", async () => {
    const markup = renderToStaticMarkup(
      await DiscoverPage({
        searchParams: Promise.resolve({ category: "us-general" }),
      })
    )

    expect(markup).toContain("Discover Feeds")
    expect(markup).toContain("US General")
    expect(markup).toContain("27 feeds")
    expect(markup).toContain("ABC News - U.S.")
    expect(markup).toContain("abcnews.com")
    expect(markup).toContain("Fox News - Latest")
    expect(markup).toContain("foxnews.com")
    expect(markup.match(/Directory control:/g)).toHaveLength(27)
    expect(markup).toContain(
      "Directory control: npr-national | NPR - National | subscribed=true | folders=folder-1:Morning News"
    )
    expect(markup).toContain(
      "Directory control: npr-world | NPR - World | subscribed=false | folders=folder-1:Morning News"
    )
  })

  it("falls back to US General for an unknown category", async () => {
    const markup = renderToStaticMarkup(
      await DiscoverPage({
        searchParams: Promise.resolve({ category: "unknown" }),
      })
    )

    expect(markup).toContain("US General")
    expect(markup).toContain('href="/app/discover?category=us-general"')
    expect(markup).toContain("27 feeds")
  })

  it("redirects unauthenticated users before loading reader data", async () => {
    mocks.auth.mockResolvedValue(null)

    await expect(
      DiscoverPage({
        searchParams: Promise.resolve({ category: "us-general" }),
      })
    ).rejects.toThrow("REDIRECT:/login")

    expect(mocks.redirect).toHaveBeenCalledWith("/login")
    expect(mocks.listUserFolders).not.toHaveBeenCalled()
    expect(mocks.listUserFeedSubscriptions).not.toHaveBeenCalled()
  })
})

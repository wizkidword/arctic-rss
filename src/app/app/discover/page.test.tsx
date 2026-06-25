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

  it("renders all categories as collapsed sections by default", async () => {
    const markup = renderToStaticMarkup(
      await DiscoverPage({
        searchParams: Promise.resolve({ category: "us-general" }),
      })
    )
    const detailTags = markup.match(/<details[^>]*>/g) ?? []

    expect(markup).toContain("Discover Feeds")
    expect(markup).toContain("US General")
    expect(markup).toContain("US Politics")
    expect(markup).toContain("US Business")
    expect(markup).toContain("US Health")
    expect(markup).toContain("US Science")
    expect(markup).toContain("US Sports")
    expect(markup).toContain("148 feeds")
    expect(markup).toContain("Campaigns, Congress, policy")
    expect(markup).toContain("Markets, companies, economy")
    expect(markup).toContain("Health news, wellness, medicine")
    expect(markup).toContain("Science news, space, research")
    expect(markup).toContain("Sports headlines, analysis, scores")
    expect(markup).toContain("27 feeds")
    expect(markup).toContain("33 feeds")
    expect(markup).toContain("11 feeds")
    expect(markup).toContain("26 feeds")
    expect(markup).toContain("39 feeds")
    expect(markup).toContain("12 feeds")
    expect(markup).toContain("ABC News - U.S.")
    expect(markup).toContain("abcnews.com")
    expect(markup).toContain("Fox News - Latest")
    expect(markup).toContain("foxnews.com")
    expect(markup).toContain("Politico Magazine")
    expect(markup).toContain("NPR - Politics")
    expect(markup).toContain("Wall Street Journal - U.S. Business")
    expect(markup).toContain("Bloomberg Law")
    expect(markup).toContain("CNN Health")
    expect(markup).toContain("NPR - Health")
    expect(markup).toContain("WIRED - Science")
    expect(markup).toContain("NPR - Science")
    expect(markup).toContain("ESPN - Top News")
    expect(markup).toContain("Sports Illustrated")
    expect(markup).toContain('<nav aria-label="Feed categories"')
    expect(markup.match(/aria-current="page"/g)).toHaveLength(1)
    expect(markup).toContain(
      'href="/app/discover?category=us-general#directory-category-us-general" aria-current="page"'
    )
    expect(markup).toContain(
      'href="/app/discover?category=us-politics#directory-category-us-politics"'
    )
    expect(markup).toContain(
      'href="/app/discover?category=us-business#directory-category-us-business"'
    )
    expect(markup).toContain(
      'href="/app/discover?category=us-health#directory-category-us-health"'
    )
    expect(markup).toContain(
      'href="/app/discover?category=us-science#directory-category-us-science"'
    )
    expect(markup).toContain(
      'href="/app/discover?category=us-sports#directory-category-us-sports"'
    )
    expect(detailTags).toHaveLength(6)
    expect(detailTags[0]).toContain('id="directory-category-us-general"')
    expect(detailTags[0]).not.toContain("open")
    expect(detailTags[1]).toContain('id="directory-category-us-politics"')
    expect(detailTags[1]).not.toContain("open")
    expect(detailTags[2]).toContain('id="directory-category-us-business"')
    expect(detailTags[2]).not.toContain("open")
    expect(detailTags[3]).toContain('id="directory-category-us-health"')
    expect(detailTags[3]).not.toContain("open")
    expect(detailTags[4]).toContain('id="directory-category-us-science"')
    expect(detailTags[4]).not.toContain("open")
    expect(detailTags[5]).toContain('id="directory-category-us-sports"')
    expect(detailTags[5]).not.toContain("open")
    expect(markup).toContain("<summary")
    expect(markup).toContain("<ul")
    expect(markup.match(/<li /g)).toHaveLength(148)
    expect(markup).toContain("w-full shrink-0 sm:w-auto sm:pl-4")
    expect(markup).toContain(
      "[&amp;_[data-slot=button]]:w-full [&amp;_[data-slot=button]]:min-h-9"
    )
    expect(markup).toContain(
      "sm:[&amp;_[data-slot=button]]:w-auto sm:[&amp;_[data-slot=button]]:min-h-7"
    )
    expect(markup.match(/Directory control:/g)).toHaveLength(148)
    expect(markup).toContain(
      "Directory control: npr-national | NPR - National | subscribed=true | folders=folder-1:Morning News"
    )
    expect(markup).toContain(
      "Directory control: npr-world | NPR - World | subscribed=false | folders=folder-1:Morning News"
    )
    expect(markup).toContain(
      "Directory control: npr-politics | NPR - Politics | subscribed=false | folders=folder-1:Morning News"
    )
    expect(markup).toContain(
      "Directory control: wsj-us-business | Wall Street Journal - U.S. Business | subscribed=false | folders=folder-1:Morning News"
    )
    expect(markup).toContain(
      "Directory control: npr-health | NPR - Health | subscribed=false | folders=folder-1:Morning News"
    )
    expect(markup).toContain(
      "Directory control: wired-science | WIRED - Science | subscribed=false | folders=folder-1:Morning News"
    )
    expect(markup).toContain(
      "Directory control: espn-top-news | ESPN - Top News | subscribed=false | folders=folder-1:Morning News"
    )
  })

  it("marks US Politics in navigation without opening it by default", async () => {
    const markup = renderToStaticMarkup(
      await DiscoverPage({
        searchParams: Promise.resolve({ category: "us-politics" }),
      })
    )
    const detailTags = markup.match(/<details[^>]*>/g) ?? []

    expect(markup).toContain(
      'href="/app/discover?category=us-politics#directory-category-us-politics" aria-current="page"'
    )
    expect(detailTags).toHaveLength(6)
    expect(detailTags[0]).toContain('id="directory-category-us-general"')
    expect(detailTags[0]).not.toContain("open")
    expect(detailTags[1]).toContain('id="directory-category-us-politics"')
    expect(detailTags[1]).not.toContain("open")
    expect(detailTags[2]).toContain('id="directory-category-us-business"')
    expect(detailTags[2]).not.toContain("open")
    expect(detailTags[3]).toContain('id="directory-category-us-health"')
    expect(detailTags[3]).not.toContain("open")
    expect(detailTags[4]).toContain('id="directory-category-us-science"')
    expect(detailTags[4]).not.toContain("open")
    expect(detailTags[5]).toContain('id="directory-category-us-sports"')
    expect(detailTags[5]).not.toContain("open")
    expect(markup).toContain("Politico Magazine")
    expect(markup).toContain("NPR - Politics")
  })

  it("marks US Business in navigation without opening it by default", async () => {
    const markup = renderToStaticMarkup(
      await DiscoverPage({
        searchParams: Promise.resolve({ category: "us-business" }),
      })
    )
    const detailTags = markup.match(/<details[^>]*>/g) ?? []

    expect(markup).toContain(
      'href="/app/discover?category=us-business#directory-category-us-business" aria-current="page"'
    )
    expect(detailTags).toHaveLength(6)
    expect(detailTags[0]).toContain('id="directory-category-us-general"')
    expect(detailTags[0]).not.toContain("open")
    expect(detailTags[1]).toContain('id="directory-category-us-politics"')
    expect(detailTags[1]).not.toContain("open")
    expect(detailTags[2]).toContain('id="directory-category-us-business"')
    expect(detailTags[2]).not.toContain("open")
    expect(detailTags[3]).toContain('id="directory-category-us-health"')
    expect(detailTags[3]).not.toContain("open")
    expect(detailTags[4]).toContain('id="directory-category-us-science"')
    expect(detailTags[4]).not.toContain("open")
    expect(detailTags[5]).toContain('id="directory-category-us-sports"')
    expect(detailTags[5]).not.toContain("open")
    expect(markup).toContain("Wall Street Journal - U.S. Business")
    expect(markup).toContain("Bloomberg Law")
  })

  it("marks US Health in navigation without opening it by default", async () => {
    const markup = renderToStaticMarkup(
      await DiscoverPage({
        searchParams: Promise.resolve({ category: "us-health" }),
      })
    )
    const detailTags = markup.match(/<details[^>]*>/g) ?? []

    expect(markup).toContain(
      'href="/app/discover?category=us-health#directory-category-us-health" aria-current="page"'
    )
    expect(detailTags).toHaveLength(6)
    expect(detailTags[0]).toContain('id="directory-category-us-general"')
    expect(detailTags[0]).not.toContain("open")
    expect(detailTags[1]).toContain('id="directory-category-us-politics"')
    expect(detailTags[1]).not.toContain("open")
    expect(detailTags[2]).toContain('id="directory-category-us-business"')
    expect(detailTags[2]).not.toContain("open")
    expect(detailTags[3]).toContain('id="directory-category-us-health"')
    expect(detailTags[3]).not.toContain("open")
    expect(detailTags[4]).toContain('id="directory-category-us-science"')
    expect(detailTags[4]).not.toContain("open")
    expect(detailTags[5]).toContain('id="directory-category-us-sports"')
    expect(detailTags[5]).not.toContain("open")
    expect(markup).toContain("CNN Health")
    expect(markup).toContain("NPR - Health")
  })

  it("marks US Science in navigation without opening it by default", async () => {
    const markup = renderToStaticMarkup(
      await DiscoverPage({
        searchParams: Promise.resolve({ category: "us-science" }),
      })
    )
    const detailTags = markup.match(/<details[^>]*>/g) ?? []

    expect(markup).toContain(
      'href="/app/discover?category=us-science#directory-category-us-science" aria-current="page"'
    )
    expect(detailTags).toHaveLength(6)
    expect(detailTags[0]).toContain('id="directory-category-us-general"')
    expect(detailTags[0]).not.toContain("open")
    expect(detailTags[1]).toContain('id="directory-category-us-politics"')
    expect(detailTags[1]).not.toContain("open")
    expect(detailTags[2]).toContain('id="directory-category-us-business"')
    expect(detailTags[2]).not.toContain("open")
    expect(detailTags[3]).toContain('id="directory-category-us-health"')
    expect(detailTags[3]).not.toContain("open")
    expect(detailTags[4]).toContain('id="directory-category-us-science"')
    expect(detailTags[4]).not.toContain("open")
    expect(detailTags[5]).toContain('id="directory-category-us-sports"')
    expect(detailTags[5]).not.toContain("open")
    expect(markup).toContain("WIRED - Science")
    expect(markup).toContain("NPR - Science")
  })

  it("marks US Sports in navigation without opening it by default", async () => {
    const markup = renderToStaticMarkup(
      await DiscoverPage({
        searchParams: Promise.resolve({ category: "us-sports" }),
      })
    )
    const detailTags = markup.match(/<details[^>]*>/g) ?? []

    expect(markup).toContain(
      'href="/app/discover?category=us-sports#directory-category-us-sports" aria-current="page"'
    )
    expect(detailTags).toHaveLength(6)
    expect(detailTags[0]).toContain('id="directory-category-us-general"')
    expect(detailTags[0]).not.toContain("open")
    expect(detailTags[1]).toContain('id="directory-category-us-politics"')
    expect(detailTags[1]).not.toContain("open")
    expect(detailTags[2]).toContain('id="directory-category-us-business"')
    expect(detailTags[2]).not.toContain("open")
    expect(detailTags[3]).toContain('id="directory-category-us-health"')
    expect(detailTags[3]).not.toContain("open")
    expect(detailTags[4]).toContain('id="directory-category-us-science"')
    expect(detailTags[4]).not.toContain("open")
    expect(detailTags[5]).toContain('id="directory-category-us-sports"')
    expect(detailTags[5]).not.toContain("open")
    expect(markup).toContain("ESPN - Top News")
    expect(markup).toContain("Sports Illustrated")
  })

  it("falls back to US General for an unknown category", async () => {
    const markup = renderToStaticMarkup(
      await DiscoverPage({
        searchParams: Promise.resolve({ category: "unknown" }),
      })
    )

    expect(markup).toContain("US General")
    expect(markup).toContain(
      'href="/app/discover?category=us-general#directory-category-us-general" aria-current="page"'
    )
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

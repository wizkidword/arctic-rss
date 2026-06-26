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
    expect(markup).toContain("US Tech")
    expect(markup).toContain("US Entertainment")
    expect(markup).toContain("US Gaming")
    expect(markup).toContain("CA General")
    expect(markup).toContain("CA Politics")
    expect(markup).toContain("CA Business")
    expect(markup).toContain("CA Gaming")
    expect(markup).toContain("CA Health")
    expect(markup).toContain("CA Science")
    expect(markup).toContain("CA Sports")
    expect(markup).toContain("CA Tech")
    expect(markup).toContain("CA Entertainment")
    expect(markup).toContain("IN General")
    expect(markup).toContain("IN Politics")
    expect(markup).toContain("IN Business")
    expect(markup).toContain("IN Health")
    expect(markup).toContain("IN Science")
    expect(markup).toContain("IN Sports")
    expect(markup).toContain("IN Tech")
    expect(markup).toContain("IN Entertainment")
    expect(markup).toContain("IN Gaming")
    expect(markup).toContain("GB General")
    expect(markup).toContain("GB Politics")
    expect(markup).toContain("GB Business")
    expect(markup).toContain("GB Health")
    expect(markup).toContain("GB Science")
    expect(markup).toContain("GB Sports")
    expect(markup).toContain("GB Tech")
    expect(markup).toContain("GB Entertainment")
    expect(markup).toContain("GB Gaming")
    expect(markup).toContain("466 feeds")
    expect(markup).toContain("Campaigns, Congress, policy")
    expect(markup).toContain("Markets, companies, economy")
    expect(markup).toContain("Health news, wellness, medicine")
    expect(markup).toContain("Science news, space, research")
    expect(markup).toContain("Sports headlines, analysis, scores")
    expect(markup).toContain("Technology news, startups, gadgets")
    expect(markup).toContain("Entertainment news, TV, movies")
    expect(markup).toContain("Video game news, reviews, deals")
    expect(markup).toContain("Canadian national, regional")
    expect(markup).toContain("Canadian federal politics")
    expect(markup).toContain("Canadian markets, economy")
    expect(markup).toContain("Canadian gaming news")
    expect(markup).toContain("Indian national, regional")
    expect(markup).toContain("Indian elections, Parliament")
    expect(markup).toContain("Indian markets, companies")
    expect(markup).toContain("Indian health news, medicine")
    expect(markup).toContain("Indian science, research")
    expect(markup).toContain("Indian sports headlines")
    expect(markup).toContain("Indian technology news")
    expect(markup).toContain("Indian film, television")
    expect(markup).toContain("Indian video game news")
    expect(markup).toContain("British national, regional")
    expect(markup).toContain("British Parliament, policy")
    expect(markup).toContain("British markets, companies")
    expect(markup).toContain("British health news")
    expect(markup).toContain("British science, environment")
    expect(markup).toContain("British sports headlines")
    expect(markup).toContain("British technology news")
    expect(markup).toContain("British film, television")
    expect(markup).toContain("British video game news")
    expect(markup).toContain("27 feeds")
    expect(markup).toContain("33 feeds")
    expect(markup).toContain("11 feeds")
    expect(markup).toContain("26 feeds")
    expect(markup).toContain("39 feeds")
    expect(markup).toContain("12 feeds")
    expect(markup).toContain("45 feeds")
    expect(markup).toContain("21 feeds")
    expect(markup).toContain("20 feeds")
    expect(markup).toContain("17 feeds")
    expect(markup).toContain("9 feeds")
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
    expect(markup).toContain("TechCrunch")
    expect(markup).toContain("The Verge - Tech")
    expect(markup).toContain("Variety")
    expect(markup).toContain("Deadline")
    expect(markup).toContain("IGN")
    expect(markup).toContain("Kotaku")
    expect(markup).toContain("CBC - Canada")
    expect(markup).toContain("National Post - Politics")
    expect(markup).toContain("Financial Post")
    expect(markup).toContain("COGconnected")
    expect(markup).toContain("LaineyGossip")
    expect(markup).toContain("Hindustan Times - India")
    expect(markup).toContain("NDTV Profit")
    expect(markup).toContain("IndiaBioscience")
    expect(markup).toContain("IGN India")
    expect(markup).toContain("BBC News - UK")
    expect(markup).toContain("NHS England")
    expect(markup).toContain("TechRadar")
    expect(markup).toContain("Eurogamer")
    expect(markup).toContain('<nav aria-label="Nations"')
    expect(markup.match(/href="\/app\/discover#directory-country-/g)).toHaveLength(4)
    expect(markup).toContain('href="/app/discover#directory-country-us"')
    expect(markup).toContain('href="/app/discover#directory-country-ca"')
    expect(markup).toContain('href="/app/discover#directory-country-in"')
    expect(markup).toContain('href="/app/discover#directory-country-gb"')
    expect(markup).toContain('id="directory-country-us"')
    expect(markup).toContain('id="directory-country-ca"')
    expect(markup).toContain('id="directory-country-in"')
    expect(markup).toContain('id="directory-country-gb"')
    expect(markup).toContain('aria-label="US feed categories"')
    expect(markup).toContain('aria-label="CA feed categories"')
    expect(markup).toContain('aria-label="IN feed categories"')
    expect(markup).toContain('aria-label="GB feed categories"')
    expect(markup).not.toContain("/app/discover?category=us-politics")
    expect(markup).not.toContain("/app/discover?category=ca-general")
    expect(markup).not.toContain("/app/discover?category=in-general")
    expect(markup).not.toContain("/app/discover?category=gb-general")
    expect(markup.match(/aria-current="page"/g) ?? []).toHaveLength(0)
    expect(markup).toContain(
      "grid scroll-mt-4 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
    )
    expect(markup).toContain("min-h-32")
    expect(markup).toContain("bg-sky-50 text-sky-700")
    expect(markup).toContain("bg-lime-50 text-lime-700")
    expect(detailTags).toHaveLength(36)
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
    expect(detailTags[6]).toContain('id="directory-category-us-tech"')
    expect(detailTags[6]).not.toContain("open")
    expect(detailTags[7]).toContain('id="directory-category-us-entertainment"')
    expect(detailTags[7]).not.toContain("open")
    expect(detailTags[8]).toContain('id="directory-category-us-gaming"')
    expect(detailTags[8]).not.toContain("open")
    expect(detailTags[9]).toContain('id="directory-category-ca-general"')
    expect(detailTags[9]).not.toContain("open")
    expect(detailTags[17]).toContain('id="directory-category-ca-entertainment"')
    expect(detailTags[17]).not.toContain("open")
    expect(detailTags[18]).toContain('id="directory-category-in-general"')
    expect(detailTags[18]).not.toContain("open")
    expect(detailTags[26]).toContain('id="directory-category-in-gaming"')
    expect(detailTags[26]).not.toContain("open")
    expect(detailTags[27]).toContain('id="directory-category-gb-general"')
    expect(detailTags[27]).not.toContain("open")
    expect(detailTags[35]).toContain('id="directory-category-gb-gaming"')
    expect(detailTags[35]).not.toContain("open")
    expect(markup).toContain("<summary")
    expect(markup).toContain("<ul")
    expect(markup.match(/<li /g)).toHaveLength(466)
    expect(markup).toContain("w-full shrink-0 sm:w-auto sm:pl-4")
    expect(markup).toContain(
      "[&amp;_[data-slot=button]]:w-full [&amp;_[data-slot=button]]:min-h-9"
    )
    expect(markup).toContain(
      "sm:[&amp;_[data-slot=button]]:w-auto sm:[&amp;_[data-slot=button]]:min-h-7"
    )
    expect(markup.match(/Directory control:/g)).toHaveLength(466)
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
    expect(markup).toContain(
      "Directory control: techcrunch | TechCrunch | subscribed=false | folders=folder-1:Morning News"
    )
    expect(markup).toContain(
      "Directory control: deadline | Deadline | subscribed=false | folders=folder-1:Morning News"
    )
    expect(markup).toContain(
      "Directory control: ign | IGN | subscribed=false | folders=folder-1:Morning News"
    )
    expect(markup).toContain(
      "Directory control: cbc-canada | CBC - Canada | subscribed=false | folders=folder-1:Morning News"
    )
    expect(markup).toContain(
      "Directory control: cogconnected | COGconnected | subscribed=false | folders=folder-1:Morning News"
    )
    expect(markup).toContain(
      "Directory control: hindustan-times-india | Hindustan Times - India | subscribed=false | folders=folder-1:Morning News"
    )
    expect(markup).toContain(
      "Directory control: ndtv-profit | NDTV Profit | subscribed=false | folders=folder-1:Morning News"
    )
    expect(markup).toContain(
      "Directory control: india-bioscience | IndiaBioscience | subscribed=false | folders=folder-1:Morning News"
    )
    expect(markup).toContain(
      "Directory control: ign-india | IGN India | subscribed=false | folders=folder-1:Morning News"
    )
    expect(markup).toContain(
      "Directory control: bbc-uk | BBC News - UK | subscribed=false | folders=folder-1:Morning News"
    )
    expect(markup).toContain(
      "Directory control: nhs-england | NHS England | subscribed=false | folders=folder-1:Morning News"
    )
    expect(markup).toContain(
      "Directory control: techradar-uk | TechRadar | subscribed=false | folders=folder-1:Morning News"
    )
    expect(markup).toContain(
      "Directory control: eurogamer-gb | Eurogamer | subscribed=false | folders=folder-1:Morning News"
    )
  })

  it("keeps only country shortcuts in the top navigation", async () => {
    const markup = renderToStaticMarkup(
      await DiscoverPage({
        searchParams: Promise.resolve({ category: "ca-gaming" }),
      })
    )
    const detailTags = markup.match(/<details[^>]*>/g) ?? []

    expect(markup.match(/href="\/app\/discover#directory-country-/g)).toHaveLength(4)
    expect(markup).toContain('href="/app/discover#directory-country-us"')
    expect(markup).toContain('href="/app/discover#directory-country-ca"')
    expect(markup).toContain('href="/app/discover#directory-country-in"')
    expect(markup).toContain('href="/app/discover#directory-country-gb"')
    expect(markup).not.toContain("?category=ca-gaming")
    expect(detailTags).toHaveLength(36)
    expect(detailTags[8]).toContain('id="directory-category-us-gaming"')
    expect(detailTags[8]).not.toContain("open")
    expect(detailTags[12]).toContain('id="directory-category-ca-gaming"')
    expect(detailTags[12]).not.toContain("open")
    expect(markup).toContain("COGconnected")
    expect(markup).toContain("CGMagazine")
    expect(markup).toContain("IGN India")
    expect(markup).toContain("Eurogamer")
  })

  it("falls back to US General for an unknown category", async () => {
    const markup = renderToStaticMarkup(
      await DiscoverPage({
        searchParams: Promise.resolve({ category: "unknown" }),
      })
    )

    expect(markup).toContain("US General")
    expect(markup).toContain('href="/app/discover#directory-country-us"')
    expect(markup).toContain('href="/app/discover#directory-country-ca"')
    expect(markup).toContain('href="/app/discover#directory-country-in"')
    expect(markup).toContain('href="/app/discover#directory-country-gb"')
    expect(markup.match(/aria-current="page"/g) ?? []).toHaveLength(0)
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

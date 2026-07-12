import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  dynamicDirectory: {
    categories: [] as Array<{
      countryCode: string | null
      description: string
      iconKey?: string
      id: string
      label: string
      sortOrder: number
    }>,
    feeds: [] as Array<{
      aliases: string[]
      categoryId: string
      id: string
      label: string
      source: string
      sortOrder: number
      url: string
    }>,
  },
  listUserFeedSubscriptions: vi.fn(),
  listUserFolders: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`)
  }),
}))

const baseCategories = [
  {
    countryCode: "us",
    description: "National and world reporting from U.S. newsrooms.",
    iconKey: "general",
    id: "us-general",
    label: "US General",
    sortOrder: 0,
  },
  {
    countryCode: "us",
    description: "Campaigns, Congress, policy, and political analysis.",
    iconKey: "politics",
    id: "us-politics",
    label: "US Politics",
    sortOrder: 1,
  },
  {
    countryCode: "ca",
    description: "Canadian national and regional reporting.",
    iconKey: "general",
    id: "ca-general",
    label: "CA General",
    sortOrder: 2,
  },
  {
    countryCode: "ca",
    description: "Canadian federal politics and policy.",
    iconKey: "politics",
    id: "ca-politics",
    label: "CA Politics",
    sortOrder: 3,
  },
]

const baseFeeds = [
  {
    aliases: [],
    categoryId: "us-general",
    id: "abc-us",
    label: "ABC News - U.S.",
    source: "abcnews.com",
    sortOrder: 0,
    url: "https://feeds.example.com/abc-us.xml",
  },
  {
    aliases: [],
    categoryId: "us-general",
    id: "npr-national",
    label: "NPR - National",
    source: "npr.org",
    sortOrder: 1,
    url: "https://feeds.example.com/npr-national.xml",
  },
  {
    aliases: [],
    categoryId: "us-politics",
    id: "politico",
    label: "Politico",
    source: "politico.com",
    sortOrder: 2,
    url: "https://feeds.example.com/politico.xml",
  },
  {
    aliases: ["https://feeds.example.com/reuters-politics-legacy.xml"],
    categoryId: "us-politics",
    id: "reuters-politics",
    label: "Reuters Politics",
    source: "reuters.com",
    sortOrder: 3,
    url: "https://feeds.example.com/reuters-politics.xml",
  },
  {
    aliases: [],
    categoryId: "us-politics",
    id: "subscribed-wire",
    label: "Subscribed Wire",
    source: "example.com",
    sortOrder: 4,
    url: "https://feeds.example.com/subscribed.xml",
  },
  {
    aliases: [],
    categoryId: "ca-general",
    id: "cbc-canada",
    label: "CBC - Canada",
    source: "cbc.ca",
    sortOrder: 5,
    url: "https://feeds.example.com/cbc.xml",
  },
  {
    aliases: [],
    categoryId: "ca-politics",
    id: "national-post-politics",
    label: "National Post - Politics",
    source: "nationalpost.com",
    sortOrder: 6,
    url: "https://feeds.example.com/national-post.xml",
  },
]

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
    triggerLabel = "Subscribe",
  }: {
    feedId: string
    feedLabel: string
    folders: Array<{ id: string; name: string }>
    subscribed: boolean
    triggerLabel?: string
  }) => (
    <span>
      Directory control: {feedId} | {feedLabel} | subscribed=
      {String(subscribed)} | trigger={triggerLabel} | folders=
      {folders.map((folder) => `${folder.id}:${folder.name}`).join(",")}
    </span>
  ),
}))

vi.mock("@/lib/discover-directory", async () => {
  const actual = await vi.importActual<typeof import("@/lib/discover-directory")>(
    "@/lib/discover-directory"
  )

  return {
    ...actual,
    getDiscoverDirectory: async () => ({
      categories: [...baseCategories, ...mocks.dynamicDirectory.categories],
      feeds: [...baseFeeds, ...mocks.dynamicDirectory.feeds],
    }),
  }
})

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}))

import DiscoverPage from "./page"

describe("DiscoverPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.dynamicDirectory.categories = []
    mocks.dynamicDirectory.feeds = []
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
        feedUrl: "https://feeds.example.com/subscribed.xml",
        folderId: null,
        folderName: null,
        id: "subscription-1",
        isPaused: false,
        lastError: null,
        siteUrl: "https://example.com",
        title: "Subscribed Wire",
        unreadCount: 0,
      },
    ])
  })

  it("starts on a compact interest picker instead of rendering every feed", async () => {
    const markup = renderToStaticMarkup(
      await DiscoverPage({
        searchParams: Promise.resolve({}),
      })
    )

    expect(markup).toContain("Choose Interests")
    expect(markup).toContain('href="/app/discover?interest=general"')
    expect(markup).toContain('href="/app/discover?interest=politics"')
    expect(markup).toContain('<nav aria-label="Nations"')
    expect(markup).toContain("flex-wrap")
    expect(markup).not.toContain("flex-nowrap")
    expect(markup).not.toContain("overflow-x-auto")
    expect(markup).toContain('href="/app/discover?nation=us"')
    expect(markup).toContain('href="/app/discover?nation=ca"')
    expect(markup).not.toContain('href="/app/discover#directory-country-us"')
    expect(markup).not.toContain("Directory control:")
    expect(markup).not.toContain("<details")
    expect(markup).not.toContain(
      "Headlines and reporting from national and regional outlets."
    )
    expect(markup).not.toContain("National and world reporting from U.S. newsrooms.")
    expect(markup).not.toContain("Canadian national and regional reporting.")
    expect(markup).not.toContain("2 categories")
  })

  it("shows all feeds for the selected interest", async () => {
    const markup = renderToStaticMarkup(
      await DiscoverPage({
        searchParams: Promise.resolve({ interest: "politics" }),
      })
    )
    const controls = markup.match(/Directory control:/g) ?? []

    expect(markup).toContain("Politics feeds")
    expect(markup).toContain("All feeds available in this topic.")
    expect(markup).toContain("Reuters Politics")
    expect(markup).toContain("National Post - Politics")
    expect(markup).toContain("Subscribed Wire")
    expect(markup).toContain(
      "https://www.google.com/s2/favicons?domain=politico.com&amp;sz=64"
    )
    expect(markup).toContain(
      "https://www.google.com/s2/favicons?domain=example.com&amp;sz=64"
    )
    expect(markup).toContain(
      "Directory control: subscribed-wire | Subscribed Wire | subscribed=true | trigger=Follow"
    )
    expect(controls).toHaveLength(4)
  })

  it("keeps country-coded categories out of the default topic cards", async () => {
    mocks.dynamicDirectory.categories = [
      {
        countryCode: null,
        description: "AU Australia RSS feeds imported from OPML.",
        iconKey: "general",
        id: "au-australia",
        label: "Australia",
        sortOrder: 5,
      },
      {
        countryCode: "bd",
        description: "Bangladeshi national and general news.",
        iconKey: "general",
        id: "bangladesh-general",
        label: "Bangladesh General",
        sortOrder: 4,
      },
    ]
    mocks.dynamicDirectory.feeds = [
      {
        aliases: [],
        categoryId: "au-australia",
        id: "australia-daily",
        label: "Australia Daily",
        source: "au.example",
        sortOrder: 0,
        url: "https://au.example/feed.xml",
      },
      {
        aliases: [],
        categoryId: "bangladesh-general",
        id: "bangladesh-daily",
        label: "Bangladesh Daily",
        source: "bd.example",
        sortOrder: 1,
        url: "https://bd.example/feed.xml",
      },
    ]

    const markup = renderToStaticMarkup(
      await DiscoverPage({
        searchParams: Promise.resolve({}),
      })
    )

    expect(markup).toContain('href="/app/discover?nation=au"')
    expect(markup).toContain('href="/app/discover?nation=bd"')
    expect(markup).toContain('href="/app/discover?interest=general"')
    expect(markup).not.toContain('href="/app/discover?interest=australia"')
    expect(markup).not.toContain('href="/app/discover?interest=bangladesh-general"')
    expect(markup).not.toContain("Australia")
    expect(markup).not.toContain("AU Australia RSS feeds imported from OPML.")
    expect(markup).not.toContain("Bangladesh General")
    expect(markup).not.toContain("Bangladeshi national and general news.")
  })

  it("routes exact country-name imports to the matching nation section", async () => {
    mocks.dynamicDirectory.categories = [
      {
        countryCode: null,
        description: "United States RSS feeds imported from OPML.",
        iconKey: "general",
        id: "opml-united-states",
        label: "United States",
        sortOrder: 5,
      },
    ]
    mocks.dynamicDirectory.feeds = [
      {
        aliases: [],
        categoryId: "opml-united-states",
        id: "opml-united-states-daily",
        label: "United States Daily",
        source: "us.example",
        sortOrder: 0,
        url: "https://us.example/feed.xml",
      },
    ]

    const defaultMarkup = renderToStaticMarkup(
      await DiscoverPage({
        searchParams: Promise.resolve({}),
      })
    )
    const usMarkup = renderToStaticMarkup(
      await DiscoverPage({
        searchParams: Promise.resolve({ nation: "us" }),
      })
    )

    expect(defaultMarkup).not.toContain(
      'href="/app/discover?interest=united-states"'
    )
    expect(defaultMarkup).not.toContain("United States RSS feeds imported from OPML.")
    expect(usMarkup).toContain('aria-label="US feed categories"')
    expect(usMarkup).toContain("United States")
    expect(usMarkup).toContain("United States Daily")
  })

  it("browses one nation at a time from the nation shortcut bar", async () => {
    const markup = renderToStaticMarkup(
      await DiscoverPage({
        searchParams: Promise.resolve({ nation: "us" }),
      })
    )

    expect(markup).toContain('aria-label="US feed categories"')
    expect(markup).toContain("US General")
    expect(markup).toContain("US Politics")
    expect(markup).toContain("ABC News - U.S.")
    expect(markup).not.toContain("CA General")
    expect(markup).not.toContain("CBC - Canada")
  })

  it("keeps topic imports in interests and country imports in nation shortcuts", async () => {
    mocks.dynamicDirectory.categories = [
      {
        countryCode: null,
        description: "Independent audio feeds imported from OPML.",
        iconKey: "audio",
        id: "opml-podcasts",
        label: "Podcasts",
        sortOrder: 0,
      },
      {
        countryCode: "zz",
        description: "Nation-backed imported feeds.",
        iconKey: "general",
        id: "zz-general",
        label: "ZZ General",
        sortOrder: 1,
      },
    ]
    mocks.dynamicDirectory.feeds = [
      {
        aliases: [],
        categoryId: "opml-podcasts",
        id: "opml-podcasts-daily-audio",
        label: "Daily Audio",
        source: "podcasts.example",
        sortOrder: 0,
        url: "https://podcasts.example/feed.xml",
      },
      {
        aliases: [],
        categoryId: "zz-general",
        id: "zz-general-national-news",
        label: "National News",
        source: "zz.example",
        sortOrder: 0,
        url: "https://zz.example/feed.xml",
      },
    ]

    const defaultMarkup = renderToStaticMarkup(
      await DiscoverPage({
        searchParams: Promise.resolve({}),
      })
    )
    const podcastMarkup = renderToStaticMarkup(
      await DiscoverPage({
        searchParams: Promise.resolve({ interest: "podcasts" }),
      })
    )
    const nationMarkup = renderToStaticMarkup(
      await DiscoverPage({
        searchParams: Promise.resolve({ nation: "zz" }),
      })
    )

    expect(defaultMarkup).toContain('href="/app/discover?interest=podcasts"')
    expect(defaultMarkup).toContain('href="/app/discover?nation=zz"')
    expect(defaultMarkup).not.toContain(">OPML</a>")
    expect(podcastMarkup).toContain("Daily Audio")
    expect(podcastMarkup).not.toContain("National News")
    expect(nationMarkup).toContain("ZZ General")
    expect(nationMarkup).toContain("National News")
  })

  it("redirects unauthenticated users before loading reader data", async () => {
    mocks.auth.mockResolvedValue(null)

    await expect(
      DiscoverPage({
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow("REDIRECT:/login")

    expect(mocks.redirect).toHaveBeenCalledWith("/login")
    expect(mocks.listUserFolders).not.toHaveBeenCalled()
    expect(mocks.listUserFeedSubscriptions).not.toHaveBeenCalled()
  })
})

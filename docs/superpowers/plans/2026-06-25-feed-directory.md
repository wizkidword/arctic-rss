# Feed Directory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an extensible in-app Feed Directory with a US General category, verified feed endpoints, subscribed-state detection, and a folder picker that defaults to Uncategorized.

**Architecture:** A typed static catalog owns categories, feed metadata, aliases, validation, and subscription matching. An authenticated Server Action resolves catalog IDs on the server and reuses the existing safe subscription service, while a reusable client dialog handles folder choice and inline failures. A new `/app/discover` server page renders the catalog and the existing app shell exposes it directly beneath Add Feed.

**Tech Stack:** Next.js 16 App Router and Server Actions, React 19 `useActionState`, Base UI Dialog, TypeScript, Prisma/PostgreSQL, Vitest, Docker Compose.

---

## File Structure

- `src/lib/feed-directory.ts`: Static categories and feeds, catalog lookup, URL normalization, validation, and subscribed-state matching.
- `src/lib/feed-directory.test.ts`: Catalog integrity, launch contents, aliases, and matching tests.
- `src/lib/feed-subscriptions.ts`: Adds canonical feed URL to navigation subscription data.
- `src/lib/feed-subscriptions.test.ts`: Verifies feed URL is exposed without changing existing navigation behavior.
- `src/app/app/actions.ts`: Adds the authenticated directory subscription Server Action.
- `src/app/app/actions.test.ts`: Covers catalog ID validation, folder forwarding, service errors, refresh behavior, cache invalidation, and structured success state.
- `src/components/feed-directory-subscribe-button.tsx`: Reusable Subscribe/Subscribed control and folder picker.
- `src/components/feed-directory-subscribe-button.test.tsx`: Folder default, feed identity, pending state, subscribed state, and inline errors.
- `src/app/app/discover/page.tsx`: Authenticated directory page driven by catalog data.
- `src/app/app/discover/page.test.tsx`: Category fallback, feed rows, folder data, and subscribed-state rendering.
- `src/components/app-shell.tsx`: Adds Discover Feeds beneath Add Feed in desktop and mobile navigation.
- `src/components/app-shell.test.tsx`: Verifies both navigation surfaces expose the directory.
- `README.md`: Records Feed Directory support.
- `docs/superpowers/plans/2026-06-25-feed-directory.md`: Tracks execution and rollout evidence.

### Task 1: Typed Feed Directory Catalog

**Files:**
- Create: `src/lib/feed-directory.test.ts`
- Create: `src/lib/feed-directory.ts`

- [ ] **Step 1: Write failing catalog integrity tests**

Create `src/lib/feed-directory.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  feedDirectoryCategories,
  feedDirectoryFeeds,
  getFeedDirectoryCategory,
  getFeedDirectoryFeed,
  isDirectoryFeedSubscribed,
  validateFeedDirectoryCatalog,
} from "./feed-directory"

const expectedUsGeneralFeedIds = [
  "abc-news-us",
  "cnn-top-stories",
  "cbs-news-latest",
  "nyt-us",
  "wsj-us-news",
  "cs-monitor-usa",
  "nbc-top-stories",
  "nbc-world",
  "bbc-us-canada",
  "yahoo-us",
  "yahoo-world",
  "daily-beast-latest",
  "quartz",
  "guardian-us",
  "politico-politics",
  "new-yorker-news",
  "pbs-newshour-nation",
  "pbs-newshour-world",
  "npr-national",
  "npr-world",
  "atlantic-us",
  "la-times-nation",
  "la-times-world",
  "talking-points-memo",
  "salon-news",
  "time",
  "fox-news-latest",
]

describe("feed directory catalog", () => {
  it("contains one valid US General category with 27 verified feeds", () => {
    expect(validateFeedDirectoryCatalog()).toEqual([])
    expect(feedDirectoryCategories).toEqual([
      {
        description: "National and world reporting from established U.S. newsrooms.",
        id: "us-general",
        label: "US General",
      },
    ])
    expect(
      feedDirectoryFeeds
        .filter((feed) => feed.categoryId === "us-general")
        .map((feed) => feed.id)
    ).toEqual(expectedUsGeneralFeedIds)
  })

  it("looks up categories and feeds while falling back to the first category", () => {
    expect(getFeedDirectoryCategory("us-general")?.label).toBe("US General")
    expect(getFeedDirectoryCategory("missing")?.id).toBe("us-general")
    expect(getFeedDirectoryFeed("npr-national")?.url).toBe(
      "https://feeds.npr.org/1003/rss.xml"
    )
    expect(getFeedDirectoryFeed("missing")).toBeUndefined()
  })

  it("matches canonical and legacy URLs for existing subscriptions", () => {
    const nyt = getFeedDirectoryFeed("nyt-us")
    const nbc = getFeedDirectoryFeed("nbc-top-stories")

    expect(nyt).toBeDefined()
    expect(nbc).toBeDefined()
    expect(
      isDirectoryFeedSubscribed(nyt!, [
        "http://www.nytimes.com/services/xml/rss/nyt/National.xml",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(nbc!, [
        "http://feeds.nbcnews.com/feeds/topstories",
      ])
    ).toBe(true)
    expect(isDirectoryFeedSubscribed(nbc!, ["https://example.com/feed"])).toBe(
      false
    )
  })

  it("never includes the hijacked Atlantic Wire FeedBurner address", () => {
    const catalogUrls = feedDirectoryFeeds.flatMap((feed) => [
      feed.url,
      ...(feed.aliases ?? []),
    ])

    expect(catalogUrls).not.toContain(
      "http://feeds.feedburner.com/TheAtlanticWire"
    )
  })
})
```

- [ ] **Step 2: Run the catalog test to verify RED**

Run:

```powershell
npm test -- src/lib/feed-directory.test.ts
```

Expected: FAIL because `src/lib/feed-directory.ts` does not exist.

- [ ] **Step 3: Implement the typed catalog and matching helpers**

Create `src/lib/feed-directory.ts`:

```ts
export type FeedDirectoryCategory = {
  description: string
  id: string
  label: string
}

export type FeedDirectoryFeed = {
  aliases?: readonly string[]
  categoryId: string
  id: string
  label: string
  source: string
  url: string
}

export const feedDirectoryCategories = [
  {
    description: "National and world reporting from established U.S. newsrooms.",
    id: "us-general",
    label: "US General",
  },
] as const satisfies readonly FeedDirectoryCategory[]

export const feedDirectoryFeeds = [
  {
    aliases: ["http://feeds.abcnews.com/abcnews/usheadlines"],
    categoryId: "us-general",
    id: "abc-news-us",
    label: "ABC News - U.S.",
    source: "abcnews.com",
    url: "https://abcnews.com/abcnews/usheadlines",
  },
  {
    aliases: [],
    categoryId: "us-general",
    id: "cnn-top-stories",
    label: "CNN Top Stories",
    source: "cnn.com",
    url: "http://rss.cnn.com/rss/cnn_topstories.rss",
  },
  {
    aliases: ["http://www.cbsnews.com/latest/rss/main"],
    categoryId: "us-general",
    id: "cbs-news-latest",
    label: "CBS News - Latest",
    source: "cbsnews.com",
    url: "https://www.cbsnews.com/latest/rss/main",
  },
  {
    aliases: [
      "http://www.nytimes.com/services/xml/rss/nyt/National.xml",
      "https://www.nytimes.com/services/xml/rss/nyt/National.xml",
    ],
    categoryId: "us-general",
    id: "nyt-us",
    label: "New York Times - U.S.",
    source: "nytimes.com",
    url: "https://rss.nytimes.com/services/xml/rss/nyt/US.xml",
  },
  {
    aliases: ["http://online.wsj.com/xml/rss/3_7085.xml"],
    categoryId: "us-general",
    id: "wsj-us-news",
    label: "Wall Street Journal - U.S. News",
    source: "wsj.com",
    url: "https://feeds.content.dowjones.io/public/rss/RSSUSnews",
  },
  {
    aliases: ["http://rss.csmonitor.com/feeds/usa"],
    categoryId: "us-general",
    id: "cs-monitor-usa",
    label: "Christian Science Monitor - USA",
    source: "csmonitor.com",
    url: "https://rss.csmonitor.com/feeds/usa",
  },
  {
    aliases: ["http://feeds.nbcnews.com/feeds/topstories"],
    categoryId: "us-general",
    id: "nbc-top-stories",
    label: "NBC News - Top Stories",
    source: "nbcnews.com",
    url: "https://feeds.nbcnews.com/nbcnews/public/news",
  },
  {
    aliases: ["http://feeds.nbcnews.com/feeds/worldnews"],
    categoryId: "us-general",
    id: "nbc-world",
    label: "NBC News - World",
    source: "nbcnews.com",
    url: "https://feeds.nbcnews.com/nbcnews/public/world",
  },
  {
    aliases: ["http://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml"],
    categoryId: "us-general",
    id: "bbc-us-canada",
    label: "BBC News - U.S. & Canada",
    source: "bbc.co.uk",
    url: "https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml",
  },
  {
    aliases: ["http://news.yahoo.com/rss/us"],
    categoryId: "us-general",
    id: "yahoo-us",
    label: "Yahoo News - U.S.",
    source: "yahoo.com",
    url: "https://news.yahoo.com/rss/us",
  },
  {
    aliases: ["http://rss.news.yahoo.com/rss/world"],
    categoryId: "us-general",
    id: "yahoo-world",
    label: "Yahoo News - World",
    source: "yahoo.com",
    url: "https://news.yahoo.com/rss/world",
  },
  {
    aliases: ["http://feeds.feedburner.com/thedailybeast/articles"],
    categoryId: "us-general",
    id: "daily-beast-latest",
    label: "The Daily Beast - Latest",
    source: "thedailybeast.com",
    url: "https://feeds.feedburner.com/thedailybeast/articles",
  },
  {
    aliases: ["http://qz.com/feed"],
    categoryId: "us-general",
    id: "quartz",
    label: "Quartz",
    source: "qz.com",
    url: "https://qz.com/rss",
  },
  {
    aliases: ["http://www.theguardian.com/world/usa/rss"],
    categoryId: "us-general",
    id: "guardian-us",
    label: "The Guardian - U.S. News",
    source: "theguardian.com",
    url: "https://www.theguardian.com/us-news/rss",
  },
  {
    aliases: ["http://www.politico.com/rss/politicopicks.xml"],
    categoryId: "us-general",
    id: "politico-politics",
    label: "Politico - Politics",
    source: "politico.com",
    url: "https://rss.politico.com/politics-news.xml",
  },
  {
    aliases: ["http://www.newyorker.com/feed/news"],
    categoryId: "us-general",
    id: "new-yorker-news",
    label: "The New Yorker - News",
    source: "newyorker.com",
    url: "https://www.newyorker.com/feed/news",
  },
  {
    aliases: ["http://feeds.feedburner.com/NationPBSNewsHour"],
    categoryId: "us-general",
    id: "pbs-newshour-nation",
    label: "PBS NewsHour - Nation",
    source: "pbs.org",
    url: "https://feeds.feedburner.com/NationPBSNewsHour",
  },
  {
    aliases: ["http://feeds.feedburner.com/NewshourWorld"],
    categoryId: "us-general",
    id: "pbs-newshour-world",
    label: "PBS NewsHour - World",
    source: "pbs.org",
    url: "https://feeds.feedburner.com/NewshourWorld",
  },
  {
    aliases: ["http://www.npr.org/rss/rss.php?id=1003"],
    categoryId: "us-general",
    id: "npr-national",
    label: "NPR - National",
    source: "npr.org",
    url: "https://feeds.npr.org/1003/rss.xml",
  },
  {
    aliases: ["http://www.npr.org/rss/rss.php?id=1004"],
    categoryId: "us-general",
    id: "npr-world",
    label: "NPR - World",
    source: "npr.org",
    url: "https://feeds.npr.org/1004/rss.xml",
  },
  {
    aliases: ["http://feeds.feedburner.com/AtlanticNational"],
    categoryId: "us-general",
    id: "atlantic-us",
    label: "The Atlantic - U.S.",
    source: "theatlantic.com",
    url: "https://feeds.feedburner.com/AtlanticNational",
  },
  {
    aliases: ["http://www.latimes.com/nation/rss2.0.xml"],
    categoryId: "us-general",
    id: "la-times-nation",
    label: "Los Angeles Times - Nation",
    source: "latimes.com",
    url: "https://www.latimes.com/nation/rss2.0.xml",
  },
  {
    aliases: ["http://www.latimes.com/world/rss2.0.xml"],
    categoryId: "us-general",
    id: "la-times-world",
    label: "Los Angeles Times - World",
    source: "latimes.com",
    url: "https://www.latimes.com/world/rss2.0.xml",
  },
  {
    aliases: ["http://talkingpointsmemo.com/feed/livewire"],
    categoryId: "us-general",
    id: "talking-points-memo",
    label: "Talking Points Memo",
    source: "talkingpointsmemo.com",
    url: "https://talkingpointsmemo.com/feed",
  },
  {
    aliases: ["http://www.salon.com/category/news/feed/rss/"],
    categoryId: "us-general",
    id: "salon-news",
    label: "Salon - News",
    source: "salon.com",
    url: "https://www.salon.com/category/news/feed",
  },
  {
    aliases: ["http://time.com/newsfeed/feed/"],
    categoryId: "us-general",
    id: "time",
    label: "TIME",
    source: "time.com",
    url: "https://time.com/newsfeed/feed/",
  },
  {
    aliases: ["http://feeds.foxnews.com/foxnews/latest?format=xml"],
    categoryId: "us-general",
    id: "fox-news-latest",
    label: "Fox News - Latest",
    source: "foxnews.com",
    url: "https://moxie.foxnews.com/google-publisher/latest.xml?format=xml",
  },
] as const satisfies readonly FeedDirectoryFeed[]

export function getFeedDirectoryCategory(categoryId?: string) {
  return (
    feedDirectoryCategories.find((category) => category.id === categoryId) ??
    feedDirectoryCategories[0]
  )
}

export function getFeedDirectoryFeed(feedId: string) {
  return feedDirectoryFeeds.find((feed) => feed.id === feedId)
}

export function listFeedDirectoryFeeds(categoryId: string) {
  return feedDirectoryFeeds.filter((feed) => feed.categoryId === categoryId)
}

export function isDirectoryFeedSubscribed(
  feed: FeedDirectoryFeed,
  subscriptionUrls: readonly string[]
) {
  const catalogKeys = new Set(
    [feed.url, ...(feed.aliases ?? [])].map(directoryUrlKey)
  )

  return subscriptionUrls.some((url) => {
    try {
      return catalogKeys.has(directoryUrlKey(url))
    } catch {
      return false
    }
  })
}

export function validateFeedDirectoryCatalog() {
  const errors: string[] = []
  const categoryIds = new Set<string>()
  const feedIds = new Set<string>()
  const urlOwners = new Map<string, string>()

  for (const category of feedDirectoryCategories) {
    if (categoryIds.has(category.id)) {
      errors.push(`Duplicate category ID: ${category.id}`)
    }

    categoryIds.add(category.id)

    if (!category.label.trim() || !category.description.trim()) {
      errors.push(`Incomplete category: ${category.id}`)
    }
  }

  for (const feed of feedDirectoryFeeds) {
    if (feedIds.has(feed.id)) {
      errors.push(`Duplicate feed ID: ${feed.id}`)
    }

    feedIds.add(feed.id)

    if (!categoryIds.has(feed.categoryId)) {
      errors.push(`Unknown category for feed: ${feed.id}`)
    }

    if (!feed.label.trim() || !feed.source.trim()) {
      errors.push(`Incomplete feed: ${feed.id}`)
    }

    for (const url of [feed.url, ...(feed.aliases ?? [])]) {
      try {
        const key = directoryUrlKey(url)
        const owner = urlOwners.get(key)

        if (owner && owner !== feed.id) {
          errors.push(`Duplicate feed URL: ${url}`)
        } else {
          urlOwners.set(key, feed.id)
        }
      } catch {
        errors.push(`Invalid feed URL: ${url}`)
      }
    }
  }

  return errors
}

function directoryUrlKey(input: string) {
  const url = new URL(input)

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Unsupported URL protocol")
  }

  url.protocol = "https:"
  url.hostname = url.hostname.toLowerCase()
  url.port = ""
  url.hash = ""
  url.searchParams.sort()

  if (url.pathname.length > 1) {
    url.pathname = url.pathname.replace(/\/+$/, "")
  }

  return url.href
}
```

- [ ] **Step 4: Run the catalog tests to verify GREEN**

Run:

```powershell
npm test -- src/lib/feed-directory.test.ts
npm run typecheck
```

Expected: 4 catalog tests PASS and TypeScript exits successfully.

- [ ] **Step 5: Commit the catalog**

```powershell
git add src/lib/feed-directory.ts src/lib/feed-directory.test.ts
git commit -m "Add curated feed directory catalog"
```

### Task 2: Expose Canonical Feed URLs For Subscription Matching

**Files:**
- Modify: `src/lib/feed-subscriptions.test.ts`
- Modify: `src/lib/feed-subscriptions.ts`

- [ ] **Step 1: Write the failing navigation-data assertion**

In the existing `includes folder metadata for reader navigation` test, add
`feedUrl` to the mocked feed:

```ts
feed: {
  faviconUrl: null,
  feedUrl: "https://example.com/feed.xml",
  lastError: null,
  siteUrl: "https://example.com",
  title: "Example Feed",
},
```

Add this expected property:

```ts
feedUrl: "https://example.com/feed.xml",
```

- [ ] **Step 2: Run the subscription test to verify RED**

Run:

```powershell
npm test -- src/lib/feed-subscriptions.test.ts
```

Expected: FAIL because `listUserFeedSubscriptions` does not return `feedUrl`.

- [ ] **Step 3: Add `feedUrl` to navigation subscription data**

Update `FeedSubscriptionNavItem`:

```ts
export type FeedSubscriptionNavItem = {
  faviconUrl: string | null
  feedId: string
  feedUrl: string
  folderId: string | null
  folderName: string | null
  id: string
  isPaused: boolean
  lastError: string | null
  siteUrl: string | null
  title: string
  unreadCount: number
}
```

Update the mapper in `listUserFeedSubscriptions`:

```ts
feedUrl: subscription.feed.feedUrl,
```

- [ ] **Step 4: Run focused tests and typecheck**

Run:

```powershell
npm test -- src/lib/feed-subscriptions.test.ts src/lib/feed-directory.test.ts
npm run typecheck
```

Expected: all focused tests PASS and TypeScript exits successfully.

- [ ] **Step 5: Commit canonical URL exposure**

```powershell
git add src/lib/feed-subscriptions.ts src/lib/feed-subscriptions.test.ts
git commit -m "Expose feed URLs for directory matching"
```

### Task 3: Secure Directory Subscription Server Action

**Files:**
- Modify: `src/app/app/actions.test.ts`
- Modify: `src/app/app/actions.ts`

- [ ] **Step 1: Extend action mocks**

Add a discovery error class beside the existing hoisted error classes:

```ts
class MockFeedValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "FeedValidationError"
  }
}
```

Add these functions to the existing hoisted `mocks` object:

```ts
MockFeedValidationError,
refreshFeed: vi.fn(),
subscribeToFeed: vi.fn(),
```

Expose them from the existing mocks:

```ts
vi.mock("@/lib/feed-discovery", () => ({
  FeedValidationError: mocks.MockFeedValidationError,
}))

vi.mock("@/lib/feed-refresh", () => ({
  FeedRefreshError: class FeedRefreshError extends Error {},
  refreshFeed: mocks.refreshFeed,
}))

vi.mock("@/lib/feed-subscriptions", () => ({
  FeedSubscriptionError: mocks.MockFeedSubscriptionError,
  getUserFeedSubscription: vi.fn(),
  subscribeToFeed: mocks.subscribeToFeed,
  unsubscribeFromFeed: mocks.unsubscribeFromFeed,
}))
```

Import `subscribeDirectoryFeedAction` from `./actions`.

- [ ] **Step 2: Write failing action tests**

Add:

```ts
describe("subscribeDirectoryFeedAction", () => {
  beforeEach(() => {
    mocks.auth.mockReset()
    mocks.redirect.mockClear()
    mocks.refresh.mockReset()
    mocks.refreshFeed.mockReset()
    mocks.revalidatePath.mockReset()
    mocks.subscribeToFeed.mockReset()
  })

  it("requires authentication", async () => {
    mocks.auth.mockResolvedValue(null)
    const formData = new FormData()
    formData.set("directoryFeedId", "npr-national")

    await expect(
      subscribeDirectoryFeedAction(
        { message: "", status: "idle" },
        formData
      )
    ).resolves.toEqual({
      message: "You need to sign in before subscribing.",
      status: "error",
    })
    expect(mocks.subscribeToFeed).not.toHaveBeenCalled()
  })

  it("rejects unknown catalog feed IDs", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } })
    const formData = new FormData()
    formData.set("directoryFeedId", "modified-feed-id")

    await expect(
      subscribeDirectoryFeedAction(
        { message: "", status: "idle" },
        formData
      )
    ).resolves.toEqual({
      message: "That directory feed is not available.",
      status: "error",
    })
    expect(mocks.subscribeToFeed).not.toHaveBeenCalled()
  })

  it("subscribes as Uncategorized and returns structured success", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } })
    mocks.subscribeToFeed.mockResolvedValue({
      feedId: "feed-1",
    })
    mocks.refreshFeed.mockResolvedValue({ articleCount: 12 })
    const formData = new FormData()
    formData.set("directoryFeedId", "npr-national")

    await expect(
      subscribeDirectoryFeedAction(
        { message: "", status: "idle" },
        formData
      )
    ).resolves.toEqual({
      message: "Subscribed to NPR - National. Imported 12 articles.",
      status: "success",
    })

    expect(mocks.subscribeToFeed).toHaveBeenCalledWith({
      folderId: undefined,
      url: "https://feeds.npr.org/1003/rss.xml",
      userId: "user-1",
    })
    expect(mocks.refreshFeed).toHaveBeenCalledWith("feed-1")
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app", "layout")
    expect(mocks.refresh).toHaveBeenCalled()
  })

  it("forwards an owned folder selection to the subscription service", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } })
    mocks.subscribeToFeed.mockResolvedValue({
      feedId: "feed-1",
    })
    mocks.refreshFeed.mockResolvedValue({ articleCount: 4 })
    const formData = new FormData()
    formData.set("directoryFeedId", "npr-world")
    formData.set("folderId", "folder-1")

    await expect(
      subscribeDirectoryFeedAction(
        { message: "", status: "idle" },
        formData
      )
    ).resolves.toEqual({
      message: "Subscribed to NPR - World. Imported 4 articles.",
      status: "success",
    })

    expect(mocks.subscribeToFeed).toHaveBeenCalledWith({
      folderId: "folder-1",
      url: "https://feeds.npr.org/1004/rss.xml",
      userId: "user-1",
    })
  })

  it("returns a readable folder error", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } })
    mocks.subscribeToFeed.mockRejectedValue(
      new mocks.MockFeedSubscriptionError("That folder does not exist.")
    )
    const formData = new FormData()
    formData.set("directoryFeedId", "npr-national")
    formData.set("folderId", "folder-foreign")

    await expect(
      subscribeDirectoryFeedAction(
        { message: "", status: "idle" },
        formData
      )
    ).resolves.toEqual({
      message: "That folder does not exist.",
      status: "error",
    })
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  it("returns a readable duplicate subscription error", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } })
    mocks.subscribeToFeed.mockRejectedValue(
      new mocks.MockFeedSubscriptionError(
        "You are already subscribed to NPR Topics: National."
      )
    )
    const formData = new FormData()
    formData.set("directoryFeedId", "npr-national")

    await expect(
      subscribeDirectoryFeedAction(
        { message: "", status: "idle" },
        formData
      )
    ).resolves.toEqual({
      message: "You are already subscribed to NPR Topics: National.",
      status: "error",
    })
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  it("returns a readable feed discovery error", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } })
    mocks.subscribeToFeed.mockRejectedValue(
      new mocks.MockFeedValidationError(
        "That address did not expose a readable RSS or Atom feed."
      )
    )
    const formData = new FormData()
    formData.set("directoryFeedId", "npr-national")

    await expect(
      subscribeDirectoryFeedAction(
        { message: "", status: "idle" },
        formData
      )
    ).resolves.toEqual({
      message: "That address did not expose a readable RSS or Atom feed.",
      status: "error",
    })
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  it("keeps a successful subscription when initial refresh fails", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } })
    mocks.subscribeToFeed.mockResolvedValue({
      feedId: "feed-1",
    })
    mocks.refreshFeed.mockRejectedValue(new Error("Feed temporarily offline"))
    const formData = new FormData()
    formData.set("directoryFeedId", "npr-national")

    await expect(
      subscribeDirectoryFeedAction(
        { message: "", status: "idle" },
        formData
      )
    ).resolves.toEqual({
      message:
        "Subscribed to NPR - National. Article refresh will retry.",
      status: "success",
    })
    expect(mocks.subscribeToFeed).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 3: Run action tests to verify RED**

Run:

```powershell
npm test -- src/app/app/actions.test.ts
```

Expected: FAIL because `subscribeDirectoryFeedAction` is missing.

- [ ] **Step 4: Implement the directory action**

Add the catalog import:

```ts
import { getFeedDirectoryFeed } from "@/lib/feed-directory"
```

Add the state type:

```ts
export type SubscribeDirectoryFeedActionState = {
  message: string
  status: "idle" | "success" | "error"
}
```

Add the action near `addFeedAction`:

```ts
export async function subscribeDirectoryFeedAction(
  _previousState: SubscribeDirectoryFeedActionState,
  formData: FormData
): Promise<SubscribeDirectoryFeedActionState> {
  const session = await auth()

  if (!session?.user?.id) {
    return {
      message: "You need to sign in before subscribing.",
      status: "error",
    }
  }

  const directoryFeedId = String(
    formData.get("directoryFeedId") ?? ""
  ).trim()
  const folderId = String(formData.get("folderId") ?? "").trim() || undefined
  const directoryFeed = getFeedDirectoryFeed(directoryFeedId)

  if (!directoryFeed) {
    return {
      message: "That directory feed is not available.",
      status: "error",
    }
  }

  let subscription: Awaited<ReturnType<typeof subscribeToFeed>>

  try {
    subscription = await subscribeToFeed({
      folderId,
      url: directoryFeed.url,
      userId: session.user.id,
    })
  } catch (error) {
    if (
      error instanceof FeedSubscriptionError ||
      error instanceof FeedValidationError ||
      error instanceof FeedFetchError ||
      error instanceof UnsafeUrlError
    ) {
      return {
        message: error.message,
        status: "error",
      }
    }

    return {
      message: "Arctic RSS could not subscribe to that directory feed.",
      status: "error",
    }
  }

  let refreshMessage = "Article refresh will retry."

  try {
    const refreshResult = await refreshFeed(subscription.feedId)
    refreshMessage = `Imported ${refreshResult.articleCount} articles.`
  } catch {
    // The subscription is saved; the worker can retry article refresh later.
  }

  revalidatePath("/app", "layout")
  refresh()

  return {
    message: `Subscribed to ${directoryFeed.label}. ${refreshMessage}`,
    status: "success",
  }
}
```

Keep cache refresh outside the subscription `try` block so a framework cache
failure is not mislabeled as a feed validation failure.

- [ ] **Step 5: Verify action tests, typecheck, and lint**

Run:

```powershell
npm test -- src/app/app/actions.test.ts
npm run typecheck
npm run lint -- src/app/app/actions.ts src/app/app/actions.test.ts
```

Expected: all action tests PASS; typecheck and lint exit successfully.

- [ ] **Step 6: Commit the directory action**

```powershell
git add src/app/app/actions.ts src/app/app/actions.test.ts
git commit -m "Add secure directory subscription action"
```

### Task 4: Reusable Subscribe And Folder Picker Control

**Files:**
- Create: `src/components/feed-directory-subscribe-button.test.tsx`
- Create: `src/components/feed-directory-subscribe-button.tsx`

- [ ] **Step 1: Write failing component tests**

Create `src/components/feed-directory-subscribe-button.test.tsx`:

```tsx
import type { ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>()

  return {
    ...actual,
    useActionState: vi.fn((_action, initialState) => [
      initialState,
      vi.fn(),
      false,
    ]),
  }
})

vi.mock("@/app/app/actions", () => ({
  subscribeDirectoryFeedAction: vi.fn(),
}))

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogCancel: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  AlertDialogContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogDescription: ({ children }: { children: ReactNode }) => (
    <p>{children}</p>
  ),
  AlertDialogFooter: ({ children }: { children: ReactNode }) => (
    <footer>{children}</footer>
  ),
  AlertDialogHeader: ({ children }: { children: ReactNode }) => (
    <header>{children}</header>
  ),
  AlertDialogTitle: ({ children }: { children: ReactNode }) => (
    <h2>{children}</h2>
  ),
  AlertDialogTrigger: ({ children }: { children: ReactNode }) => (
    <button>{children}</button>
  ),
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}))

import {
  FeedDirectorySubscribeButton,
  FeedDirectorySubscribeDialogContent,
} from "./feed-directory-subscribe-button"

const folders = [
  { id: "folder-1", name: "Morning News" },
  { id: "folder-2", name: "Research" },
]

describe("FeedDirectorySubscribeButton", () => {
  it("defaults the folder picker to Uncategorized", () => {
    const markup = renderToStaticMarkup(
      <FeedDirectorySubscribeDialogContent
        action={() => undefined}
        feedId="npr-national"
        feedLabel="NPR - National"
        folders={folders}
        pending={false}
        state={{ message: "", status: "idle" }}
      />
    )

    expect(markup).toContain("Subscribe to NPR - National")
    expect(markup).toContain('name="directoryFeedId"')
    expect(markup).toContain('value="npr-national"')
    expect(markup).toContain('name="folderId"')
    expect(markup).toContain('<option value="" selected="">Uncategorized</option>')
    expect(markup).toContain('<option value="folder-1">Morning News</option>')
    expect(markup).toContain('<option value="folder-2">Research</option>')
  })

  it("disables controls and renders a feed-specific error", () => {
    const markup = renderToStaticMarkup(
      <FeedDirectorySubscribeDialogContent
        action={() => undefined}
        feedId="npr-national"
        feedLabel="NPR - National"
        folders={folders}
        pending
        state={{
          message: "That folder does not exist.",
          status: "error",
        }}
      />
    )

    expect(markup).toContain("Subscribing")
    expect(markup).toContain("disabled")
    expect(markup).toContain("That folder does not exist.")
  })

  it("renders Subscribe for available feeds and Subscribed for existing feeds", () => {
    const availableMarkup = renderToStaticMarkup(
      <FeedDirectorySubscribeButton
        feedId="npr-national"
        feedLabel="NPR - National"
        folders={folders}
        subscribed={false}
      />
    )
    const subscribedMarkup = renderToStaticMarkup(
      <FeedDirectorySubscribeButton
        feedId="npr-national"
        feedLabel="NPR - National"
        folders={folders}
        subscribed
      />
    )

    expect(availableMarkup).toContain("Subscribe")
    expect(availableMarkup).toContain("NPR - National")
    expect(subscribedMarkup).toContain("Subscribed")
    expect(subscribedMarkup).toContain("disabled")
  })
})
```

- [ ] **Step 2: Run component tests to verify RED**

Run:

```powershell
npm test -- src/components/feed-directory-subscribe-button.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the Subscribe/Subscribed control**

Create `src/components/feed-directory-subscribe-button.tsx`:

```tsx
"use client"

import {
  useActionState,
  useEffect,
  useState,
  type ComponentProps,
} from "react"
import { CheckIcon, FolderIcon, RssIcon } from "lucide-react"

import {
  subscribeDirectoryFeedAction,
  type SubscribeDirectoryFeedActionState,
} from "@/app/app/actions"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

const initialState: SubscribeDirectoryFeedActionState = {
  message: "",
  status: "idle",
}

type DirectoryFolder = {
  id: string
  name: string
}

export function FeedDirectorySubscribeButton({
  feedId,
  feedLabel,
  folders,
  subscribed,
}: {
  feedId: string
  feedLabel: string
  folders: DirectoryFolder[]
  subscribed: boolean
}) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(
    subscribeDirectoryFeedAction,
    initialState
  )

  useEffect(() => {
    if (state.status === "success") {
      setOpen(false)
    }
  }, [state.status])

  if (subscribed) {
    return (
      <Button disabled size="sm" variant="secondary">
        <CheckIcon data-icon="inline-start" />
        Subscribed
        <span className="sr-only"> to {feedLabel}</span>
      </Button>
    )
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button size="sm" variant="outline" />}>
        <RssIcon data-icon="inline-start" />
        Subscribe
        <span className="sr-only"> to {feedLabel}</span>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <FeedDirectorySubscribeDialogContent
          action={action}
          feedId={feedId}
          feedLabel={feedLabel}
          folders={folders}
          pending={pending}
          state={state}
        />
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function FeedDirectorySubscribeDialogContent({
  action,
  feedId,
  feedLabel,
  folders,
  pending,
  state,
}: {
  action: ComponentProps<"form">["action"]
  feedId: string
  feedLabel: string
  folders: DirectoryFolder[]
  pending: boolean
  state: SubscribeDirectoryFeedActionState
}) {
  return (
    <form action={action} className="grid gap-4">
      <input name="directoryFeedId" type="hidden" value={feedId} />
      <AlertDialogHeader>
        <AlertDialogTitle>Subscribe to {feedLabel}</AlertDialogTitle>
        <AlertDialogDescription>
          Choose where this feed should appear in your reader.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <label className="grid gap-1.5 text-sm" htmlFor={`folder-${feedId}`}>
        <span className="font-medium">Folder</span>
        <span className="relative">
          <FolderIcon className="pointer-events-none absolute top-2 left-2.5 size-4 text-muted-foreground" />
          <select
            className="h-8 w-full rounded-lg border border-input bg-background pr-2.5 pl-8 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            defaultValue=""
            disabled={pending}
            id={`folder-${feedId}`}
            name="folderId"
          >
            <option value="">Uncategorized</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        </span>
      </label>
      {state.status === "error" && (
        <p aria-live="polite" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending} type="button">
          Cancel
        </AlertDialogCancel>
        <Button disabled={pending} type="submit">
          <RssIcon data-icon="inline-start" />
          {pending ? "Subscribing" : "Subscribe"}
        </Button>
      </AlertDialogFooter>
    </form>
  )
}
```

- [ ] **Step 4: Run component tests, typecheck, and lint**

Run:

```powershell
npm test -- src/components/feed-directory-subscribe-button.test.tsx
npm run typecheck
npm run lint -- src/components/feed-directory-subscribe-button.tsx src/components/feed-directory-subscribe-button.test.tsx
```

Expected: 3 component tests PASS; typecheck and lint exit successfully.

- [ ] **Step 5: Commit the folder picker**

```powershell
git add src/components/feed-directory-subscribe-button.tsx src/components/feed-directory-subscribe-button.test.tsx
git commit -m "Add feed directory folder picker"
```

### Task 5: Feed Directory Page

**Files:**
- Create: `src/app/app/discover/page.test.tsx`
- Create: `src/app/app/discover/page.tsx`

- [ ] **Step 1: Write the failing page test**

Create `src/app/app/discover/page.test.tsx`:

```tsx
import type { ReactNode } from "react"
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
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
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
      Directory control {feedId} {feedLabel} {String(subscribed)}{" "}
      {folders.map((folder) => folder.name).join(",")}
    </span>
  ),
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}))

import DiscoverFeedsPage from "./page"

describe("DiscoverFeedsPage", () => {
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
        title: "NPR Topics: National",
        unreadCount: 0,
      },
    ])
  })

  it("renders US General and marks matching legacy subscriptions", async () => {
    const markup = renderToStaticMarkup(
      await DiscoverFeedsPage({
        searchParams: Promise.resolve({
          category: "us-general",
        }),
      })
    )

    expect(markup).toContain("Discover Feeds")
    expect(markup).toContain("US General")
    expect(markup).toContain("27 feeds")
    expect(markup).toContain("ABC News - U.S.")
    expect(markup).toContain("Fox News - Latest")
    expect(markup).toContain(
      "Directory control npr-national NPR - National true Morning News"
    )
    expect(markup).toContain(
      "Directory control npr-world NPR - World false Morning News"
    )
  })

  it("falls back to US General for an unknown category", async () => {
    const markup = renderToStaticMarkup(
      await DiscoverFeedsPage({
        searchParams: Promise.resolve({
          category: "unknown",
        }),
      })
    )

    expect(markup).toContain("US General")
    expect(markup).toContain('href="/app/discover?category=us-general"')
  })
})
```

- [ ] **Step 2: Run the page test to verify RED**

Run:

```powershell
npm test -- src/app/app/discover/page.test.tsx
```

Expected: FAIL because the Discover page does not exist.

- [ ] **Step 3: Implement the data-driven Discover page**

Create `src/app/app/discover/page.tsx`:

```tsx
import Link from "next/link"
import { redirect } from "next/navigation"
import { CompassIcon, RssIcon } from "lucide-react"

import { auth } from "@/auth"
import { FeedDirectorySubscribeButton } from "@/components/feed-directory-subscribe-button"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  feedDirectoryCategories,
  getFeedDirectoryCategory,
  isDirectoryFeedSubscribed,
  listFeedDirectoryFeeds,
} from "@/lib/feed-directory"
import { listUserFeedSubscriptions } from "@/lib/feed-subscriptions"
import { listUserFolders } from "@/lib/folders"
import { cn } from "@/lib/utils"

export default async function DiscoverFeedsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string | string[] }>
}) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const params = await searchParams
  const requestedCategory = firstSearchParam(params.category)
  const category = getFeedDirectoryCategory(requestedCategory)

  if (!category) {
    throw new Error("Feed directory has no categories.")
  }

  const [folders, subscriptions] = await Promise.all([
    listUserFolders(session.user.id),
    listUserFeedSubscriptions(session.user.id),
  ])
  const feeds = listFeedDirectoryFeeds(category.id)
  const subscriptionUrls = subscriptions.map(
    (subscription) => subscription.feedUrl
  )
  const pickerFolders = folders.map((folder) => ({
    id: folder.id,
    name: folder.name,
  }))

  return (
    <div className="flex min-h-screen flex-col gap-4 p-3 sm:p-4 lg:p-6">
      <section className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <CompassIcon className="size-5 text-muted-foreground" />
            <h1 className="font-heading text-xl font-semibold">
              Discover Feeds
            </h1>
            <Badge variant="secondary">
              {feeds.length} {feeds.length === 1 ? "feed" : "feeds"}
            </Badge>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Browse curated RSS feeds and add them directly to your reader.
          </p>
        </div>
      </section>

      <div className="flex flex-wrap gap-2" aria-label="Feed categories">
        {feedDirectoryCategories.map((item) => (
          <Link
            className={cn(
              buttonVariants({
                size: "sm",
                variant: item.id === category.id ? "secondary" : "outline",
              })
            )}
            href={`/app/discover?category=${encodeURIComponent(item.id)}`}
            key={item.id}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <section className="rounded-lg border bg-card">
        <div className="flex items-center justify-between gap-3 border-b p-4">
          <div>
            <h2 className="font-heading text-base font-medium">
              {category.label}
            </h2>
            <p className="text-sm text-muted-foreground">
              {category.description}
            </p>
          </div>
          <Badge variant="secondary">{feeds.length} feeds</Badge>
        </div>
        <div className="divide-y">
          {feeds.map((feed) => (
            <div
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              key={feed.id}
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <RssIcon className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium">{feed.label}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {feed.source}
                  </p>
                </div>
              </div>
              <FeedDirectorySubscribeButton
                feedId={feed.id}
                feedLabel={feed.label}
                folders={pickerFolders}
                subscribed={isDirectoryFeedSubscribed(feed, subscriptionUrls)}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}
```

- [ ] **Step 4: Run page and feature tests**

Run:

```powershell
npm test -- src/app/app/discover/page.test.tsx src/components/feed-directory-subscribe-button.test.tsx src/lib/feed-directory.test.ts
npm run typecheck
npm run lint -- src/app/app/discover/page.tsx src/app/app/discover/page.test.tsx
```

Expected: all focused tests PASS; typecheck and lint exit successfully.

- [ ] **Step 5: Commit the directory page**

```powershell
git add src/app/app/discover/page.tsx src/app/app/discover/page.test.tsx
git commit -m "Add curated feed directory page"
```

### Task 6: Discover Feeds Navigation Entry

**Files:**
- Create: `src/components/app-shell.test.tsx`
- Modify: `src/components/app-shell.tsx`

- [ ] **Step 1: Write the failing shell navigation test**

Create `src/components/app-shell.test.tsx`:

```tsx
import type { ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
}))

vi.mock("@/components/add-feed-sheet", () => ({
  AddFeedSheet: () => <span>Add Feed</span>,
}))

vi.mock("@/components/admin-account-link", () => ({
  AdminAccountLink: () => null,
}))

vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  AvatarFallback: ({ children }: { children: ReactNode }) => (
    <span>{children}</span>
  ),
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({ children }: { children: ReactNode }) => <button>{children}</button>,
  buttonVariants: () => "",
}))

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuGroup: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuLabel: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}))

vi.mock("@/components/ui/separator", () => ({
  Separator: () => <hr />,
}))

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  SheetTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

import { AppShell } from "./app-shell"

describe("AppShell", () => {
  it("places Discover Feeds beneath Add Feed in desktop and mobile navigation", () => {
    const markup = renderToStaticMarkup(
      <AppShell
        feedSubscriptions={[]}
        folders={[]}
        readerCounts={{
          allCount: 0,
          starredCount: 0,
          unreadCount: 0,
        }}
        user={{
          email: "reader@example.com",
          name: "Reader",
          role: "USER",
        }}
      >
        <div>Reader content</div>
      </AppShell>
    )

    expect(markup.match(/href="\/app\/discover"/g)).toHaveLength(2)
    expect(markup.match(/Discover Feeds/g)).toHaveLength(2)
    expect(markup.indexOf("Add Feed")).toBeLessThan(
      markup.indexOf("Discover Feeds")
    )
  })
})
```

- [ ] **Step 2: Run the shell test to verify RED**

Run:

```powershell
npm test -- src/components/app-shell.test.tsx
```

Expected: FAIL because the shell does not render Discover Feeds.

- [ ] **Step 3: Add the navigation command**

Add `CompassIcon` to the `lucide-react` imports in `app-shell.tsx`.

Immediately after `<AddFeedSheet folders={folders} />`, add:

```tsx
<Link
  href="/app/discover"
  className={cn(
    buttonVariants({ variant: "outline", size: "sm" }),
    "h-7 justify-start gap-2 px-2"
  )}
>
  <CompassIcon data-icon="inline-start" />
  <span className="min-w-0 flex-1 truncate text-left">
    Discover Feeds
  </span>
</Link>
```

Because `ReaderNav` is reused by desktop and mobile navigation, one change
exposes both entry points.

- [ ] **Step 4: Run shell and page tests**

Run:

```powershell
npm test -- src/components/app-shell.test.tsx src/app/app/discover/page.test.tsx
npm run typecheck
npm run lint -- src/components/app-shell.tsx src/components/app-shell.test.tsx
```

Expected: both test files PASS; typecheck and lint exit successfully.

- [ ] **Step 5: Commit navigation**

```powershell
git add src/components/app-shell.tsx src/components/app-shell.test.tsx
git commit -m "Expose feed discovery in reader navigation"
```

### Task 7: Documentation, Full Verification, Deployment, And Browser QA

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-06-25-feed-directory.md`

- [ ] **Step 1: Document the completed capability**

Add to the README Done list:

```markdown
- Curated Feed Directory with extensible categories
- One-click catalog subscription with Uncategorized or folder assignment
```

- [ ] **Step 2: Run the full repository verification**

Run:

```powershell
npm test
npm run typecheck
npm run lint
npx prisma validate
npm run build
docker compose config --quiet
```

Expected:

- 0 test failures.
- TypeScript and ESLint exit successfully.
- Prisma reports the schema is valid.
- Next.js builds all application routes including `/app/discover`.
- Docker Compose configuration is valid.

- [ ] **Step 3: Mark implementation checklist items and commit documentation**

Mark completed implementation steps in this plan, then run:

```powershell
git add README.md docs/superpowers/plans/2026-06-25-feed-directory.md
git commit -m "Document curated feed directory"
```

- [ ] **Step 4: Rebuild the live application**

Run:

```powershell
docker compose up -d --build web worker
docker compose ps
```

Expected:

- PostgreSQL and Redis are healthy.
- Web is healthy on `127.0.0.1:3003`.
- Worker is running.

- [ ] **Step 5: Seed an isolated QA reader and folder**

Run:

```powershell
$qaJson = @'
import { getPrisma } from "./src/lib/db"
import { hashPassword } from "./src/lib/password"
import { defaultUserSettings } from "./src/lib/settings"

const prisma = getPrisma()
const suffix = Date.now().toString()
const email = `directory-qa-${suffix}@arcticrss.local`
const password = `Qa-Directory-${suffix}!`
const qaFeedUrls = [
  "https://feeds.npr.org/1003/rss.xml",
  "https://feeds.npr.org/1004/rss.xml",
]
const preexistingFeeds = await prisma.feed.findMany({
  where: {
    feedUrl: {
      in: qaFeedUrls,
    },
  },
  select: {
    id: true,
  },
})

const user = await prisma.user.create({
  data: {
    email,
    name: "Directory QA",
    passwordHash: await hashPassword(password),
    settings: {
      create: defaultUserSettings(),
    },
  },
})
const folder = await prisma.folder.create({
  data: {
    name: "Directory QA Folder",
    userId: user.id,
  },
})

console.log(JSON.stringify({
  email,
  folderId: folder.id,
  password,
  preexistingFeedIds: preexistingFeeds.map((feed) => feed.id),
  userId: user.id,
}))
await prisma.$disconnect()
'@ | docker compose exec -T worker npx tsx -

$qa = $qaJson | Select-Object -Last 1 | ConvertFrom-Json
$env:QA_DIRECTORY_EMAIL = $qa.email
$env:QA_DIRECTORY_FOLDER_ID = $qa.folderId
$env:QA_DIRECTORY_PASSWORD = $qa.password
$env:QA_DIRECTORY_PREEXISTING_FEED_IDS = ConvertTo-Json `
  -Compress `
  -InputObject @($qa.preexistingFeedIds)
$env:QA_DIRECTORY_USER_ID = $qa.userId
```

- [ ] **Step 6: Browser-smoke both folder choices**

Using the in-app browser and the isolated credentials:

1. Sign in and open **Discover Feeds** from the sidebar.
2. Confirm **US General** shows 27 feed rows.
3. Open NPR National's folder picker.
4. Confirm **Uncategorized** is selected by default.
5. Subscribe to NPR National as Uncategorized.
6. Confirm the picker closes, the row changes to **Subscribed**, and NPR
   appears in the sidebar.
7. Open NPR World's folder picker.
8. Select **Directory QA Folder** and subscribe.
9. Confirm NPR World appears under that folder.
10. Confirm neither feed still offers Subscribe.
11. Confirm no relevant browser console errors.

- [ ] **Step 7: Verify database assignments and clean QA records**

Run:

```powershell
@'
import { getPrisma } from "./src/lib/db"

const prisma = getPrisma()
const userId = process.env.QA_DIRECTORY_USER_ID!
const folderId = process.env.QA_DIRECTORY_FOLDER_ID!
const preexistingFeedIds = JSON.parse(
  process.env.QA_DIRECTORY_PREEXISTING_FEED_IDS ?? "[]"
) as string[]
const subscriptions = await prisma.feedSubscription.findMany({
  where: {
    userId,
  },
  include: {
    feed: true,
  },
})

const national = subscriptions.find(
  (subscription) =>
    subscription.feed.feedUrl === "https://feeds.npr.org/1003/rss.xml"
)
const world = subscriptions.find(
  (subscription) =>
    subscription.feed.feedUrl === "https://feeds.npr.org/1004/rss.xml"
)
const result = {
  nationalFolderId: national?.folderId ?? null,
  subscriptionCount: subscriptions.length,
  worldFolderId: world?.folderId ?? null,
}
console.log(JSON.stringify(result))

if (
  subscriptions.length !== 2 ||
  result.nationalFolderId !== null ||
  result.worldFolderId !== folderId
) {
  throw new Error("Feed Directory folder assignment verification failed.")
}

const qaFeedIds = subscriptions
  .map((subscription) => subscription.feedId)
  .filter((feedId) => !preexistingFeedIds.includes(feedId))

await prisma.user.delete({
  where: {
    id: userId,
  },
})
await prisma.feed.deleteMany({
  where: {
    id: {
      in: qaFeedIds,
    },
    subscriptions: {
      none: {},
    },
  },
})
await prisma.$disconnect()
'@ | docker compose exec -T `
  -e QA_DIRECTORY_USER_ID="$env:QA_DIRECTORY_USER_ID" `
  -e QA_DIRECTORY_FOLDER_ID="$env:QA_DIRECTORY_FOLDER_ID" `
  -e QA_DIRECTORY_PREEXISTING_FEED_IDS="$env:QA_DIRECTORY_PREEXISTING_FEED_IDS" `
  worker npx tsx -
```

Expected JSON:

```json
{"nationalFolderId":null,"subscriptionCount":2,"worldFolderId":"<QA folder ID>"}
```

- [ ] **Step 8: Verify public health and push**

Run:

```powershell
curl.exe --fail https://arcticrss.taverncellar.com/api/health
git status --short
git push origin main
git rev-parse HEAD
git ls-remote origin refs/heads/main
```

Expected:

- Public health returns database and Redis `ok`.
- The worktree is clean.
- Local and remote `main` SHAs match.

import { describe, expect, it } from "vitest"

import {
  feedDirectoryCategories,
  feedDirectoryFeeds,
  getFeedDirectoryCategory,
  getFeedDirectoryFeed,
  isDirectoryFeedSubscribed,
  listFeedDirectoryFeeds,
  validateFeedDirectoryCatalog,
} from "./feed-directory"

const expectedFeedIds = [
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
  it("contains the approved category and validates without errors", () => {
    expect(feedDirectoryCategories).toEqual([
      {
        description:
          "National and world reporting from established U.S. newsrooms.",
        id: "us-general",
        label: "US General",
      },
    ])
    expect(validateFeedDirectoryCatalog()).toEqual([])
  })

  it("contains exactly the expected feeds in order", () => {
    expect(feedDirectoryFeeds.map((feed) => feed.id)).toEqual(expectedFeedIds)
    expect(feedDirectoryFeeds).toHaveLength(27)
    expect(
      feedDirectoryFeeds.every((feed) => feed.categoryId === "us-general")
    ).toBe(true)
  })

  it("looks up categories with a first-category fallback", () => {
    expect(getFeedDirectoryCategory("us-general")).toBe(
      feedDirectoryCategories[0]
    )
    expect(getFeedDirectoryCategory("missing")).toBe(
      feedDirectoryCategories[0]
    )
    expect(getFeedDirectoryCategory()).toBe(feedDirectoryCategories[0])
  })

  it("looks up feeds and lists category feeds in catalog order", () => {
    expect(getFeedDirectoryFeed("nyt-us")).toBe(feedDirectoryFeeds[3])
    expect(getFeedDirectoryFeed("missing")).toBeUndefined()
    expect(listFeedDirectoryFeeds("us-general").map((feed) => feed.id)).toEqual(
      expectedFeedIds
    )
    expect(listFeedDirectoryFeeds("missing")).toEqual([])
  })

  it("matches New York Times and NBC legacy aliases", () => {
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
  })

  it("normalizes stored HTTP URLs before matching", () => {
    const feed = getFeedDirectoryFeed("fox-news-latest")

    expect(feed).toBeDefined()
    expect(
      isDirectoryFeedSubscribed(feed!, [
        "HTTP://MOXIE.FOXNEWS.COM:80/google-publisher/latest.xml/?format=xml#top",
      ])
    ).toBe(true)
  })

  it("ignores invalid stored URLs and does not match unrelated URLs", () => {
    const feed = getFeedDirectoryFeed("nyt-us")

    expect(feed).toBeDefined()
    expect(
      isDirectoryFeedSubscribed(feed!, [
        "not a url",
        "ftp://rss.nytimes.com/services/xml/rss/nyt/US.xml",
        "https://example.com/feed.xml",
      ])
    ).toBe(false)
  })

  it("does not include the hijacked Atlantic Wire feed", () => {
    const directoryUrls = feedDirectoryFeeds.flatMap((feed) => [
      feed.url,
      ...(feed.aliases ?? []),
    ])

    expect(directoryUrls).not.toContain(
      "http://feeds.feedburner.com/TheAtlanticWire"
    )
  })
})

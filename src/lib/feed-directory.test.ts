import { describe, expect, it } from "vitest"

import {
  type FeedDirectoryFeed,
  feedDirectoryCategories,
  feedDirectoryFeeds,
  getFeedDirectoryCategory,
  getFeedDirectoryFeed,
  isDirectoryFeedSubscribed,
  listFeedDirectoryFeeds,
  validateFeedDirectoryCatalog,
} from "./feed-directory"

const expectedFeedRecords = [
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
]

const expectedFeedIds = expectedFeedRecords.map((feed) => feed.id)

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

  it("reports duplicate normalized URLs when the first feed ID is empty", () => {
    const runtimeCatalog =
      feedDirectoryFeeds as unknown as FeedDirectoryFeed[]
    const originalLength = runtimeCatalog.length

    try {
      runtimeCatalog.push(
        {
          categoryId: "us-general",
          id: "",
          label: "Empty ID Feed",
          source: "example.com",
          url: "http://EXAMPLE.com:80/collision/?b=2&a=1#first",
        },
        {
          categoryId: "us-general",
          id: "second-owner",
          label: "Second Owner",
          source: "example.com",
          url: "https://example.com/collision?a=1&b=2",
        }
      )

      expect(validateFeedDirectoryCatalog()).toContain(
        'Duplicate normalized URL "https://example.com/collision?a=1&b=2" for feeds "" and "second-owner"'
      )
    } finally {
      runtimeCatalog.splice(originalLength)
    }
  })

  it("contains exactly the approved feed records in order", () => {
    expect(
      feedDirectoryFeeds.map((feed) => ({
        aliases: [...(feed.aliases ?? [])],
        categoryId: feed.categoryId,
        id: feed.id,
        label: feed.label,
        source: feed.source,
        url: feed.url,
      }))
    ).toEqual(expectedFeedRecords)
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

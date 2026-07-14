import { describe, expect, it, vi } from "vitest"

import { refreshFeedWithClient } from "./feed-refresh"

const rssXml = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Example</title>
    <item>
      <guid>item-1</guid>
      <title>Stored Article</title>
      <link>https://example.com/stored</link>
      <description>Stored summary</description>
      <pubDate>Mon, 22 Jun 2026 10:30:00 GMT</pubDate>
    </item>
  </channel>
</rss>`

function createStore(feedUrl = "https://example.com/rss.xml") {
  return {
    $transaction: vi.fn(async (operations: Array<Promise<unknown>>) =>
      Promise.all(operations)
    ),
    article: {
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
    feed: {
      findUnique: vi.fn().mockResolvedValue({
        consecutiveFailures: 0,
        etag: null,
        feedUrl,
        id: "feed-1",
        lastModified: null,
        refreshIntervalMinutes: 60,
      }),
      update: vi.fn().mockResolvedValue({}),
    },
  }
}

describe("feed refresh", () => {
  it("fetches a feed in batches and records successful health", async () => {
    const store = createStore()
    store.article.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ externalId: "item-1", id: "article-1" }])
    const now = new Date("2026-06-22T12:00:00.000Z")
    const fetchText = vi.fn().mockResolvedValue({
      contentType: "application/rss+xml",
      text: rssXml,
      url: new URL("https://example.com/rss.xml"),
    })

    const result = await refreshFeedWithClient({
      feedId: "feed-1",
      fetchText,
      now: () => now,
      random: () => 0.5,
      store,
    })

    expect(result).toEqual(
      expect.objectContaining({
        articleCount: 1,
        feedId: "feed-1",
        newArticleIds: ["article-1"],
      })
    )
    expect(fetchText).toHaveBeenCalledWith(new URL("https://example.com/rss.xml"), {
      allowNotModified: true,
      ifModifiedSince: undefined,
      ifNoneMatch: undefined,
    })
    expect(store.article.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          externalId: "item-1",
          feedId: "feed-1",
          title: "Stored Article",
          url: "https://example.com/stored",
        }),
      ],
      skipDuplicates: true,
    })
    expect(store.article.update).not.toHaveBeenCalled()
    expect(result.metrics).toEqual(
      expect.objectContaining({
        conditionalHit: false,
        insertedCount: 1,
        parsedCount: 1,
        skippedCount: 0,
        updatedCount: 0,
      })
    )
    expect(store.feed.update).toHaveBeenCalledWith({
      data: {
        lastError: null,
        lastFailedAt: null,
        lastFetchedAt: now,
        lastSuccessfulFetchAt: now,
        consecutiveFailures: 0,
        nextFetchAt: new Date("2026-06-22T13:00:00.000Z"),
      },
      where: { id: "feed-1" },
    })
  })

  it("updates existing feed items in a bounded transaction batch", async () => {
    const store = createStore()
    store.article.findMany.mockResolvedValue([{ externalId: "item-1" }])

    await refreshFeedWithClient({
      feedId: "feed-1",
      fetchText: vi.fn().mockResolvedValue({
        contentType: "application/rss+xml",
        text: rssXml,
        url: new URL("https://example.com/rss.xml"),
      }),
      store,
    })

    expect(store.article.update).toHaveBeenCalledWith({
      data: expect.objectContaining({
        publishedAt: new Date("2026-06-22T10:30:00.000Z"),
        summary: "Stored summary",
        title: "Stored Article",
        url: "https://example.com/stored",
      }),
      where: {
        feedId_externalId: {
          externalId: "item-1",
          feedId: "feed-1",
        },
      },
    })
    expect(store.$transaction).toHaveBeenCalledTimes(1)
  })

  it("uses stored validators and skips parsing after a 304 response", async () => {
    const store = createStore()
    store.feed.findUnique.mockResolvedValue({
      consecutiveFailures: 0,
      etag: 'W/"feed-v1"',
      feedUrl: "https://example.com/rss.xml",
      id: "feed-1",
      lastModified: "Mon, 22 Jun 2026 10:30:00 GMT",
      refreshIntervalMinutes: 60,
    })
    const fetchText = vi.fn().mockResolvedValue({
      bytes: 0,
      contentType: "",
      etag: 'W/"feed-v2"',
      notModified: true,
      status: 304,
      text: "",
      url: new URL("https://example.com/rss.xml"),
    })

    const result = await refreshFeedWithClient({
      feedId: "feed-1",
      fetchText,
      store,
    })

    expect(fetchText).toHaveBeenCalledWith(new URL("https://example.com/rss.xml"), {
      allowNotModified: true,
      ifModifiedSince: "Mon, 22 Jun 2026 10:30:00 GMT",
      ifNoneMatch: 'W/"feed-v1"',
    })
    expect(store.article.createMany).not.toHaveBeenCalled()
    expect(result).toEqual(
      expect.objectContaining({ articleCount: 0, feedId: "feed-1" })
    )
    expect(result.metrics).toEqual(
      expect.objectContaining({
        bytes: 0,
        conditionalHit: true,
        parsedCount: 0,
      })
    )
    expect(store.feed.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ etag: 'W/"feed-v2"' }),
      })
    )
  })

  it("hydrates Hacker News items from the original article when the feed only provides comments", async () => {
    const store = createStore("https://news.ycombinator.com/rss")
    const now = new Date("2026-07-03T21:30:00.000Z")
    const fetchText = vi.fn().mockResolvedValue({
      contentType: "application/rss+xml",
      text: `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <title>Hacker News</title>
            <item>
              <title>Show HN: Useful Thing</title>
              <link>https://example.com/useful-thing</link>
              <description><![CDATA[<a href="https://news.ycombinator.com/item?id=123">Comments</a>]]></description>
              <pubDate>Fri, 03 Jul 2026 21:00:00 +0000</pubDate>
            </item>
          </channel>
        </rss>`,
      url: new URL("https://news.ycombinator.com/rss"),
    })
    const fetchArticleContent = vi.fn().mockResolvedValue({
      contentType: "text/html; charset=utf-8",
      text: `<!doctype html>
        <html>
          <head>
            <meta name="description" content="A useful thing for careful readers." />
            <meta property="og:image" content="/preview.jpg" />
          </head>
          <body>
            <nav>Navigation</nav>
            <article>
              <h1>Useful Thing</h1>
              <p>This is the full article body that Hacker News did not include in its RSS item.</p>
              <p>It has enough readable text to be worth showing inside Arctic RSS.</p>
            </article>
          </body>
        </html>`,
      url: new URL("https://example.com/useful-thing"),
    })

    await refreshFeedWithClient({
      feedId: "feed-1",
      fetchArticleContent,
      fetchText,
      now: () => now,
      store,
    })

    expect(fetchArticleContent).toHaveBeenCalledWith(
      new URL("https://example.com/useful-thing")
    )
    expect(store.article.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            contentText:
              "Useful Thing This is the full article body that Hacker News did not include in its RSS item. It has enough readable text to be worth showing inside Arctic RSS.",
            imageUrl: "https://example.com/preview.jpg",
            summary: "A useful thing for careful readers.",
          }),
        ],
      })
    )
  })

  it("limits linked article hydration work for a Hacker News refresh", async () => {
    const store = createStore("https://news.ycombinator.com/rss")
    const items = Array.from(
      { length: 13 },
      (_, index) => `
        <item>
          <guid>item-${index}</guid>
          <title>Story ${index}</title>
          <link>https://example.com/story-${index}</link>
          <description>Comments</description>
        </item>`
    ).join("\n")
    const fetchText = vi.fn().mockResolvedValue({
      contentType: "application/rss+xml",
      text: `<?xml version="1.0"?><rss version="2.0"><channel>${items}</channel></rss>`,
      url: new URL("https://news.ycombinator.com/rss"),
    })
    const fetchArticleContent = vi.fn().mockResolvedValue({
      contentType: "text/html",
      text: "<html><body><article>Story body</article></body></html>",
      url: new URL("https://example.com/story"),
    })

    await refreshFeedWithClient({
      feedId: "feed-1",
      fetchArticleContent,
      fetchText,
      store,
    })

    expect(fetchArticleContent).toHaveBeenCalledTimes(12)
    expect(store.article.createMany).toHaveBeenCalledTimes(1)
  })

  it("keeps linked article hydration within its small concurrency budget", async () => {
    const store = createStore("https://news.ycombinator.com/rss")
    const items = Array.from(
      { length: 6 },
      (_, index) => `
        <item>
          <guid>item-${index}</guid>
          <title>Story ${index}</title>
          <link>https://example.com/story-${index}</link>
          <description>Comments</description>
        </item>`
    ).join("\n")
    let active = 0
    let peakActive = 0
    const fetchArticleContent = vi.fn(async () => {
      active += 1
      peakActive = Math.max(peakActive, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active -= 1

      return {
        contentType: "text/html",
        text: "<html><body><article>Story body</article></body></html>",
        url: new URL("https://example.com/story"),
      }
    })

    await refreshFeedWithClient({
      feedId: "feed-1",
      fetchArticleContent,
      fetchText: vi.fn().mockResolvedValue({
        contentType: "application/rss+xml",
        text: `<?xml version="1.0"?><rss version="2.0"><channel>${items}</channel></rss>`,
        url: new URL("https://news.ycombinator.com/rss"),
      }),
      store,
    })

    expect(fetchArticleContent).toHaveBeenCalledTimes(6)
    expect(peakActive).toBeLessThanOrEqual(3)
  })

  it("does not fetch original pages for ordinary RSS summaries", async () => {
    const store = createStore()
    const fetchText = vi.fn().mockResolvedValue({
      contentType: "application/rss+xml",
      text: rssXml,
      url: new URL("https://example.com/rss.xml"),
    })
    const fetchArticleContent = vi.fn()

    await refreshFeedWithClient({
      feedId: "feed-1",
      fetchArticleContent,
      fetchText,
      store,
    })

    expect(fetchArticleContent).not.toHaveBeenCalled()
  })

  it("records failed health when the fetch fails", async () => {
    const store = createStore()
    const now = new Date("2026-06-22T12:00:00.000Z")
    const fetchText = vi.fn().mockRejectedValue(new Error("network down"))

    await expect(
      refreshFeedWithClient({
        feedId: "feed-1",
        fetchText,
        now: () => now,
        random: () => 0.5,
        store,
      })
    ).rejects.toThrow("network down")

    expect(store.article.createMany).not.toHaveBeenCalled()
    expect(store.feed.update).toHaveBeenCalledWith({
      data: {
        lastError: "network down",
        lastFailedAt: now,
        lastFetchedAt: now,
        consecutiveFailures: 1,
        nextFetchAt: new Date("2026-06-22T14:00:00.000Z"),
      },
      where: { id: "feed-1" },
    })
  })
})

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
    article: {
      upsert: vi.fn().mockResolvedValue({}),
    },
    feed: {
      findUnique: vi.fn().mockResolvedValue({
        feedUrl,
        id: "feed-1",
      }),
      update: vi.fn().mockResolvedValue({}),
    },
  }
}

describe("feed refresh", () => {
  it("fetches a feed, upserts parsed articles, and records successful health", async () => {
    const store = createStore()
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
      store,
    })

    expect(result).toEqual({
      articleCount: 1,
      feedId: "feed-1",
    })
    expect(fetchText).toHaveBeenCalledWith(new URL("https://example.com/rss.xml"))
    expect(store.article.upsert).toHaveBeenCalledWith({
      create: expect.objectContaining({
        externalId: "item-1",
        feedId: "feed-1",
        title: "Stored Article",
        url: "https://example.com/stored",
      }),
      update: expect.objectContaining({
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
    expect(store.feed.update).toHaveBeenCalledWith({
      data: {
        lastError: null,
        lastFailedAt: null,
        lastFetchedAt: now,
        lastSuccessfulFetchAt: now,
      },
      where: { id: "feed-1" },
    })
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
        store,
      })
    ).rejects.toThrow("network down")

    expect(store.article.upsert).not.toHaveBeenCalled()
    expect(store.feed.update).toHaveBeenCalledWith({
      data: {
        lastError: "network down",
        lastFailedAt: now,
        lastFetchedAt: now,
      },
      where: { id: "feed-1" },
    })
  })
})

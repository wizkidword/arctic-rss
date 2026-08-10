import { describe, expect, it, vi } from "vitest"

import { refreshFeedWithClient } from "./feed-refresh"
import { articleIngestionFingerprint } from "./ingestion-fingerprint"
import { externalIdentityHash } from "./external-identity"
import { parseFeedArticles } from "./feed-articles"

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
  const feedFindUnique = vi.fn().mockResolvedValue({
    consecutiveFailures: 0,
    etag: null,
    feedUrl,
    id: "feed-1",
    lastError: null,
    lastFeedSelfUrl: null,
    lastModified: null,
    lastResolvedFeedUrl: null,
    refreshGeneration: 0,
    refreshLeaseExpiresAt: null,
    refreshOwner: null,
    refreshIntervalMinutes: 60,
  })
  const feedUpdateMany = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
    const feed = await feedFindUnique({})
    if (!feed) {
      return { count: 0 }
    }

    const generation = data.refreshGeneration as { increment?: number } | undefined
    if (generation?.increment) {
      feed.refreshGeneration = (feed.refreshGeneration ?? 0) + generation.increment
    }
    if (data.refreshLeaseExpiresAt instanceof Date) {
      feed.refreshLeaseExpiresAt = data.refreshLeaseExpiresAt
    }
    if ("refreshOwner" in data) {
      feed.refreshOwner = data.refreshOwner
    }

    return { count: 1 }
  })

  return {
    $transaction: vi.fn(async (operations: Array<Promise<unknown>>) =>
      Promise.all(operations)
    ),
    article: {
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    feed: {
      findUnique: feedFindUnique,
      update: vi.fn().mockResolvedValue({}),
      updateMany: feedUpdateMany,
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
          externalIdHash: externalIdentityHash("item-1"),
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
        changedCount: 0,
        duplicateInputCount: 0,
        insertedCount: 1,
        parsedCount: 1,
        unchangedCount: 0,
      })
    )
    expect(store.feed.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
      data: expect.objectContaining({
        lastError: null,
        lastFeedSelfUrl: null,
        lastFailedAt: null,
        lastFetchedAt: now,
        lastPermanentRedirectUrl: null,
        lastResolvedFeedUrl: "https://example.com/rss.xml",
        lastSuccessfulFetchAt: now,
        lastSourceUrlObservedAt: now,
        consecutiveFailures: 0,
        nextFetchAt: new Date("2026-06-22T13:00:00.000Z"),
      }),
      where: expect.objectContaining({ id: "feed-1" }),
      })
    )
  })

  it("records source URL evidence and recovery after a successful redirected refresh", async () => {
    const store = createStore("https://example.com/old.xml")
    const now = new Date("2026-08-09T14:30:00.000Z")
    store.feed.findUnique.mockResolvedValue({
      consecutiveFailures: 2,
      etag: null,
      feedUrl: "https://example.com/old.xml",
      id: "feed-1",
      lastError: "The URL request timed out.",
      lastFeedSelfUrl: "https://example.com/previous-self.xml",
      lastModified: null,
      lastResolvedFeedUrl: "https://example.com/old.xml",
      refreshIntervalMinutes: 60,
    })

    await refreshFeedWithClient({
      feedId: "feed-1",
      fetchText: vi.fn().mockResolvedValue({
        contentType: "application/rss+xml",
        redirects: [
          {
            from: "https://example.com/old.xml",
            status: 308,
            to: "https://feeds.example.com/current.xml",
          },
        ],
        text: rssXml.replace(
          "<channel>",
          '<channel><atom:link href="https://feeds.example.com/self.xml" rel="self" />'
        ),
        url: new URL("https://feeds.example.com/current.xml"),
      }),
      now: () => now,
      random: () => 0.5,
      store,
    })

    expect(store.feed.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastFeedSelfUrl: "https://feeds.example.com/self.xml",
          lastPermanentRedirectUrl: "https://feeds.example.com/current.xml",
          lastRecoveredAt: now,
          lastResolvedFeedUrl: "https://feeds.example.com/current.xml",
          lastSourceUrlObservedAt: now,
          previousFeedSelfUrl: "https://example.com/previous-self.xml",
          previousResolvedFeedUrl: "https://example.com/old.xml",
        }),
      })
    )
  })

  it("updates existing feed items in a bounded transaction batch", async () => {
    const store = createStore()
    store.article.findMany.mockResolvedValue([
      { externalId: "item-1", ingestionFingerprint: "outdated" },
    ])

    await refreshFeedWithClient({
      feedId: "feed-1",
      fetchText: vi.fn().mockResolvedValue({
        contentType: "application/rss+xml",
        text: rssXml,
        url: new URL("https://example.com/rss.xml"),
      }),
      store,
    })

    expect(store.article.updateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        publishedAt: new Date("2026-06-22T10:30:00.000Z"),
        externalIdHash: externalIdentityHash("item-1"),
        summary: "Stored summary",
        title: "Stored Article",
        url: "https://example.com/stored",
      }),
      where: expect.objectContaining({
        externalId: "item-1",
        feedId: "feed-1",
      }),
    })
    expect(store.$transaction).toHaveBeenCalledTimes(1)
  })

  it("does not rewrite an article whose normalized source content is unchanged", async () => {
    const store = createStore()
    const [article] = parseFeedArticles(rssXml, "https://example.com/rss.xml")
    store.article.findMany.mockResolvedValue([
      {
        externalId: "item-1",
        ingestionFingerprint: articleIngestionFingerprint(article),
        sourceGeneration: 1,
      },
    ])

    const result = await refreshFeedWithClient({
      feedId: "feed-1",
      fetchText: vi.fn().mockResolvedValue({
        contentType: "application/rss+xml",
        text: rssXml,
        url: new URL("https://example.com/rss.xml"),
      }),
      store,
    })

    expect(store.article.createMany).not.toHaveBeenCalled()
    expect(store.article.updateMany).not.toHaveBeenCalled()
    expect(result.metrics).toEqual(
      expect.objectContaining({
        changedCount: 0,
        insertedCount: 0,
        unchangedCount: 1,
      })
    )
  })

  it("persists a corrected article only when its fingerprint changes", async () => {
    const store = createStore()
    const [original] = parseFeedArticles(rssXml, "https://example.com/rss.xml")
    store.article.findMany.mockResolvedValue([
      {
        externalId: "item-1",
        ingestionFingerprint: articleIngestionFingerprint(original),
        sourceGeneration: 1,
      },
    ])

    await refreshFeedWithClient({
      feedId: "feed-1",
      fetchText: vi.fn().mockResolvedValue({
        contentType: "application/rss+xml",
        text: rssXml.replace("Stored Article", "Corrected Article"),
        url: new URL("https://example.com/rss.xml"),
      }),
      store,
    })

    expect(store.article.createMany).not.toHaveBeenCalled()
    expect(store.article.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: "Corrected Article" }),
      })
    )
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
    expect(store.feed.updateMany).toHaveBeenCalledWith(
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
            <link rel="canonical" href="/canonical-useful-thing" />
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
            canonicalUrl: "https://example.com/canonical-useful-thing",
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
    expect(store.feed.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
      data: {
        lastError: "network down",
        lastFailedAt: now,
        lastFetchedAt: now,
        consecutiveFailures: 1,
        nextFetchAt: new Date("2026-06-22T14:00:00.000Z"),
      },
      where: expect.objectContaining({ id: "feed-1" }),
      })
    )
  })

  it("keeps generation-two data when a stalled generation-one refresh resumes", async () => {
    const { feed, items, store } = createGenerationFencingStore()
    const startedAt = new Date(Date.now())
    const replacementStartedAt = new Date(startedAt.getTime() + 2_000)
    const stalledFetch = deferred<{
      contentType: string
      text: string
      url: URL
    }>()
    const first = refreshFeedWithClient({
      feedId: "feed-1",
      fetchText: () => stalledFetch.promise,
      leaseDurationMs: 1_000,
      leaseOwner: "worker-one",
      now: () => startedAt,
      store,
    })

    await vi.waitFor(() => expect(feed.refreshOwner).toBe("worker-one"))
    await refreshFeedWithClient({
      feedId: "feed-1",
      fetchText: async () => ({
        contentType: "application/rss+xml",
        text: rssXml.replace("Stored Article", "Generation two article"),
        url: new URL("https://example.com/rss.xml"),
      }),
      leaseDurationMs: 1_000,
      leaseOwner: "worker-two",
      now: () => replacementStartedAt,
      store,
    })

    stalledFetch.resolve({
      contentType: "application/rss+xml",
      text: rssXml.replace("Stored Article", "Stale generation one article"),
      url: new URL("https://example.com/rss.xml"),
    })

    await expect(first).resolves.toEqual({
      articleCount: 0,
      feedId: "feed-1",
      skipped: true,
    })
    expect(items.get("item-1")).toMatchObject({
      sourceGeneration: 2,
      title: "Generation two article",
    })
    expect(feed.lastSuccessfulFetchAt).toEqual(replacementStartedAt)
  })

  it("does not let a stalled generation-one failure overwrite generation-two success", async () => {
    const { feed, store } = createGenerationFencingStore()
    const startedAt = new Date(Date.now())
    const replacementStartedAt = new Date(startedAt.getTime() + 2_000)
    const stalledFetch = deferred<never>()
    const first = refreshFeedWithClient({
      feedId: "feed-1",
      fetchText: () => stalledFetch.promise,
      leaseDurationMs: 1_000,
      leaseOwner: "worker-one",
      now: () => startedAt,
      store,
    })

    await vi.waitFor(() => expect(feed.refreshOwner).toBe("worker-one"))
    await refreshFeedWithClient({
      feedId: "feed-1",
      fetchText: async () => ({
        contentType: "application/rss+xml",
        text: rssXml.replace("Stored Article", "Generation two article"),
        url: new URL("https://example.com/rss.xml"),
      }),
      leaseDurationMs: 1_000,
      leaseOwner: "worker-two",
      now: () => replacementStartedAt,
      store,
    })

    stalledFetch.reject(new Error("stale fetch failed"))

    await expect(first).rejects.toThrow("stale fetch failed")
    expect(feed).toMatchObject({
      consecutiveFailures: 0,
      lastError: null,
      lastSuccessfulFetchAt: replacementStartedAt,
      refreshGeneration: 2,
    })
  })
})

function deferred<Value>() {
  let reject!: (error: unknown) => void
  let resolve!: (value: Value) => void
  const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return { promise, reject, resolve }
}

type GenerationFencingFeed = {
  consecutiveFailures: number
  etag: string | null
  feedUrl: string
  id: string
  lastError: string | null
  lastFeedSelfUrl: string | null
  lastModified: string | null
  lastResolvedFeedUrl: string | null
  lastSuccessfulFetchAt?: Date
  refreshGeneration: number
  refreshIntervalMinutes: number
  refreshLeaseExpiresAt: Date | null
  refreshOwner: string | null
  [key: string]: unknown
}

type GenerationFencingItem = {
  externalId: string
  id: string
  ingestionFingerprint: string | null
  sourceGeneration: number | null
  title: string
  [key: string]: unknown
}

function createGenerationFencingStore() {
  const feed: GenerationFencingFeed = {
    consecutiveFailures: 0,
    etag: null,
    feedUrl: "https://example.com/rss.xml",
    id: "feed-1",
    lastError: null,
    lastFeedSelfUrl: null,
    lastModified: null,
    lastResolvedFeedUrl: null,
    refreshGeneration: 0,
    refreshLeaseExpiresAt: null,
    refreshOwner: null,
    refreshIntervalMinutes: 60,
  }
  const items = new Map<string, GenerationFencingItem>()
  const store = {
    $transaction: async (operations: Array<Promise<unknown>>) => Promise.all(operations),
    article: {
      createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => {
        let count = 0
        for (const item of data) {
          const externalId = String(item.externalId)
          if (!items.has(externalId)) {
            items.set(externalId, {
              ...item,
              externalId,
              id: `article-${externalId}`,
              ingestionFingerprint: String(item.ingestionFingerprint),
              sourceGeneration: Number(item.sourceGeneration),
              title: String(item.title),
            })
            count += 1
          }
        }
        return { count }
      },
      findMany: async ({ where }: { where: { externalId: { in: string[] } } }) =>
        where.externalId.in.flatMap((externalId) => {
          const item = items.get(externalId)
          return item ? [{ ...item }] : []
        }),
      updateMany: async ({
        data,
        where,
      }: {
        data: Record<string, unknown>
        where: Record<string, unknown>
      }) => {
        const item = items.get(String(where.externalId))
        const conditions = where.OR as Array<Record<string, unknown>>
        const mayUpdate = conditions.some((condition) =>
          condition.sourceGeneration === null
            ? item?.sourceGeneration === null
            : item?.sourceGeneration !== undefined &&
                item.sourceGeneration !== null &&
                item.sourceGeneration < (condition.sourceGeneration as { lt: number }).lt,
        )
        if (!item || !mayUpdate) {
          return { count: 0 }
        }

        Object.assign(item, data)
        return { count: 1 }
      },
    },
    feed: {
      findUnique: async () => ({ ...feed }),
      updateMany: async ({
        data,
        where,
      }: {
        data: Record<string, unknown>
        where: Record<string, unknown>
      }) => {
        if (where.id !== feed.id) {
          return { count: 0 }
        }

        const alternatives = where.OR as Array<Record<string, unknown>> | undefined
        if (alternatives) {
          const available = alternatives.some((condition) =>
            condition.refreshLeaseExpiresAt === null
              ? feed.refreshLeaseExpiresAt === null
              : Boolean(
                  feed.refreshLeaseExpiresAt &&
                    feed.refreshLeaseExpiresAt <=
                      (condition.refreshLeaseExpiresAt as { lte: Date }).lte,
                ),
          )
          if (!available) {
            return { count: 0 }
          }
        } else if (
          where.refreshGeneration !== feed.refreshGeneration ||
          where.refreshOwner !== feed.refreshOwner ||
          !feed.refreshLeaseExpiresAt ||
          feed.refreshLeaseExpiresAt <=
            (where.refreshLeaseExpiresAt as { gt: Date }).gt
        ) {
          return { count: 0 }
        }

        const generation = data.refreshGeneration as { increment?: number } | undefined
        if (generation?.increment) {
          feed.refreshGeneration = Number(feed.refreshGeneration) + generation.increment
        }
        const sourceData = { ...data }
        delete sourceData.refreshGeneration
        Object.assign(feed, sourceData)
        return { count: 1 }
      },
    },
  }

  return { feed, items, store }
}

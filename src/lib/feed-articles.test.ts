import { describe, expect, it } from "vitest"

import { parseFeedArticles, parseFeedArticlesWithMetrics } from "./feed-articles"

describe("feed article parsing", () => {
  it("normalizes RSS items into article records", () => {
    const articles = parseFeedArticles(
      `<?xml version="1.0"?>
      <rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/">
        <channel>
          <title>Example Feed</title>
          <item>
            <guid isPermaLink="false">item-1</guid>
            <title>Hello RSS</title>
            <link>https://example.com/posts/hello</link>
            <dc:creator>Reporter</dc:creator>
            <description><![CDATA[<p>Short <strong>summary</strong>.</p>]]></description>
            <content:encoded><![CDATA[<p>Full <em>article</em> text.</p><img src="https://example.com/image.jpg" />]]></content:encoded>
            <media:content url="https://example.com/media.jpg" medium="image" />
            <pubDate>Mon, 22 Jun 2026 10:30:00 GMT</pubDate>
          </item>
        </channel>
      </rss>`,
      "https://example.com/rss.xml"
    )

    expect(articles).toEqual([
      expect.objectContaining({
        author: "Reporter",
        contentText: "Full article text.",
        externalId: "item-1",
        imageUrl: "https://example.com/media.jpg",
        publishedAt: new Date("2026-06-22T10:30:00.000Z"),
        summary: "Short summary.",
        title: "Hello RSS",
        url: "https://example.com/posts/hello",
      }),
    ])
  })

  it("uses RSS media thumbnails as article images", () => {
    const articles = parseFeedArticles(
      `<?xml version="1.0"?>
      <rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
        <channel>
          <item>
            <guid isPermaLink="false">wired-1</guid>
            <title>WIRED Science</title>
            <link>https://www.wired.com/story/example/</link>
            <description>A science story.</description>
            <media:content/>
            <media:thumbnail url="https://media.wired.com/photos/example/master/pass/science.jpg" width="2400" height="1600"/>
          </item>
        </channel>
      </rss>`,
      "https://www.wired.com/feed/category/science/latest/rss"
    )

    expect(articles[0]).toEqual(
      expect.objectContaining({
        imageUrl: "https://media.wired.com/photos/example/master/pass/science.jpg",
      })
    )
  })

  it("normalizes Atom entries into article records", () => {
    const articles = parseFeedArticles(
      `<?xml version="1.0"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <title>Example Atom</title>
        <entry>
          <id>tag:example.com,2026:atom-1</id>
          <title>Atom Entry</title>
          <link rel="alternate" href="/posts/atom-entry" />
          <link rel="canonical" href="https://publisher.example/posts/atom-entry" />
          <author><name>Atom Author</name></author>
          <summary>Atom summary</summary>
          <content type="html"><![CDATA[<p>Atom full text.</p>]]></content>
          <updated>2026-06-22T11:00:00Z</updated>
        </entry>
      </feed>`,
      "https://example.com/atom.xml"
    )

    expect(articles).toEqual([
      expect.objectContaining({
        author: "Atom Author",
        canonicalUrl: "https://publisher.example/posts/atom-entry",
        contentText: "Atom full text.",
        externalId: "tag:example.com,2026:atom-1",
        publishedAt: new Date("2026-06-22T11:00:00.000Z"),
        summary: "Atom summary",
        title: "Atom Entry",
        url: "https://example.com/posts/atom-entry",
      }),
    ])
  })

  it("normalizes YouTube Atom entries with thumbnails and descriptions", () => {
    const articles = parseFeedArticles(
      `<?xml version="1.0" encoding="UTF-8"?>
      <feed xmlns:yt="http://www.youtube.com/xml/schemas/2015"
        xmlns:media="http://search.yahoo.com/mrss/"
        xmlns="http://www.w3.org/2005/Atom">
        <title>YouTube Channel</title>
        <entry>
          <id>yt:video:dQw4w9WgXcQ</id>
          <yt:videoId>dQw4w9WgXcQ</yt:videoId>
          <yt:channelId>UC_x5XG1OV2P6uZZ5FSM9Ttw</yt:channelId>
          <title>Video Entry</title>
          <link rel="alternate" href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"/>
          <author><name>Example Channel</name></author>
          <published>2026-07-01T12:00:00+00:00</published>
          <media:group>
            <media:title>Video Entry</media:title>
            <media:description>A useful video from the channel.</media:description>
            <media:thumbnail url="https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" width="480" height="360"/>
          </media:group>
        </entry>
      </feed>`,
      "https://www.youtube.com/feeds/videos.xml?channel_id=UC_x5XG1OV2P6uZZ5FSM9Ttw"
    )

    expect(articles).toEqual([
      expect.objectContaining({
        author: "Example Channel",
        externalId: "yt:video:dQw4w9WgXcQ",
        imageUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
        publishedAt: new Date("2026-07-01T12:00:00.000Z"),
        summary: "A useful video from the channel.",
        title: "Video Entry",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      }),
    ])
  })

  it("falls back to a stable external id when feed items omit ids", () => {
    const [article] = parseFeedArticles(
      `<?xml version="1.0"?>
      <rss version="2.0">
        <channel>
          <item>
            <title>Untitled ID</title>
            <link>https://example.com/no-guid</link>
          </item>
        </channel>
      </rss>`,
      "https://example.com/rss.xml"
    )

    expect(article.externalId).toBe("https://example.com/no-guid")
  })

  it("keeps only explicit, safely normalized entry canonical URLs", () => {
    const articles = parseFeedArticles(
      `<?xml version="1.0"?>
      <rss version="2.0">
        <channel>
          <item>
            <guid>safe-canonical</guid><title>Safe canonical</title>
            <link>https://reader.example/safe</link>
            <link rel="canonical" href="https://publisher.example/safe?utm_source=feed" />
          </item>
          <item>
            <guid>private-canonical</guid><title>Private canonical</title>
            <link>https://reader.example/private</link>
            <link rel="canonical" href="http://127.0.0.1/private" />
          </item>
          <item>
            <guid>credentialed-canonical</guid><title>Credentialed canonical</title>
            <link>https://reader.example/credentialed</link>
            <link rel="canonical" href="https://reader:secret@publisher.example/credentialed" />
          </item>
          <item>
            <guid>non-http-canonical</guid><title>Non HTTP canonical</title>
            <link>https://reader.example/non-http</link>
            <link rel="canonical" href="mailto:editor@publisher.example" />
          </item>
        </channel>
      </rss>`,
      "https://reader.example/rss.xml"
    )

    expect(articles[0]?.canonicalUrl).toBe(
      "https://publisher.example/safe?utm_source=feed"
    )
    expect(articles.slice(1)).toEqual(
      expect.arrayContaining([
        expect.not.objectContaining({ canonicalUrl: expect.anything() }),
      ])
    )
    expect(articles.slice(1).every((article) => article.canonicalUrl === undefined)).toBe(true)
  })

  it("keeps ordinary entities literal-safe and rejects repeated doctypes", () => {
    const [article] = parseFeedArticles(
      `<!DOCTYPE rss [<!ENTITY publisher "untrusted">]><rss><channel><item>
        <guid>entity-safe</guid><title>News &amp; &publisher;</title>
        <link>https://example.com/entity-safe</link>
      </item></channel></rss>`,
      "https://example.com/feed.xml"
    )

    expect(article.title).toBe("News & &publisher;")
    expect(() =>
      parseFeedArticles(
        "<!DOCTYPE rss><!DOCTYPE rss><rss><channel><item><link>https://example.com</link></item></channel></rss>",
        "https://example.com/feed.xml"
      )
    ).toThrow()
  })

  it("caps items and fields without allowing oversized external IDs to merge records", () => {
    const cappedItems = Array.from(
      { length: 1_001 },
      (_, index) => `<item><guid>item-${index}</guid><title>Item ${index}</title><link>https://example.com/${index}</link><description>${"x".repeat(2_048)}</description></item>`
    ).join("")
    const result = parseFeedArticlesWithMetrics(
      `<rss><channel>${cappedItems}</channel></rss>`,
      "https://example.com/feed.xml"
    )

    expect(result.articles).toHaveLength(1_000)
    expect(result.articles[999]?.externalId).toBe("item-999")
    expect(result.stats).toMatchObject({ parsedCount: 1_001, truncatedCount: 1 })
  })

  it("rejects an oversized external ID and preserves the declared source order after the item cap", () => {
    const oversizedExternalId = "x".repeat(4_097)
    const invalidItems = Array.from(
      { length: 1_000 },
      (_, index) => `<item><guid>invalid-${index}</guid><title>Invalid</title></item>`
    ).join("")
    const result = parseFeedArticlesWithMetrics(
      `<rss><channel><item><guid>${oversizedExternalId}</guid><title>Too large</title><link>https://example.com/too-large</link></item>
        <item><guid>valid</guid><title>Valid</title><link>https://example.com/valid</link></item>
        ${invalidItems}<item><guid>late-valid</guid><title>Late valid</title><link>https://example.com/late</link></item></channel></rss>`,
      "https://example.com/feed.xml"
    )

    expect(result.articles.map((article) => article.externalId)).toEqual(["valid"])
    expect(result.stats).toMatchObject({ parsedCount: 1_003, truncatedCount: 3 })
  })

  it("bounds title and content before normalizing it", () => {
    const [article] = parseFeedArticles(
      `<rss><channel><item><guid>bounded</guid><title>${"t".repeat(1_200)}</title>
        <link>https://example.com/bounded</link><content:encoded>${"x".repeat(300 * 1024)}</content:encoded>
      </item></channel></rss>`,
      "https://example.com/feed.xml"
    )

    expect(article.title).toHaveLength(1_000)
    expect(Buffer.byteLength(article.contentHtml ?? "", "utf8")).toBeLessThanOrEqual(256 * 1024)
    expect(Buffer.byteLength(article.contentText ?? "", "utf8")).toBeLessThanOrEqual(256 * 1024)
  })

  it("omits later body fields when the aggregate content budget is exhausted", () => {
    const itemBody = "x".repeat(300 * 1024)
    const items = Array.from(
      { length: 9 },
      (_, index) => `<item><guid>body-${index}</guid><title>Body ${index}</title><link>https://example.com/body-${index}</link><content:encoded>${itemBody}</content:encoded></item>`
    ).join("")
    const result = parseFeedArticlesWithMetrics(
      `<rss><channel>${items}</channel></rss>`,
      "https://example.com/feed.xml"
    )

    expect(result.stats).toMatchObject({
      contentBytes: 4 * 1024 * 1024,
      fieldsTruncated: 2,
    })
    expect(result.articles[8]?.contentHtml).toBeUndefined()
    expect(result.articles[8]?.contentText).toBeUndefined()
  })
})

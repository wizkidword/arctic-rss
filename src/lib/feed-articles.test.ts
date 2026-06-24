import { describe, expect, it } from "vitest"

import { parseFeedArticles } from "./feed-articles"

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

  it("normalizes Atom entries into article records", () => {
    const articles = parseFeedArticles(
      `<?xml version="1.0"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <title>Example Atom</title>
        <entry>
          <id>tag:example.com,2026:atom-1</id>
          <title>Atom Entry</title>
          <link rel="alternate" href="/posts/atom-entry" />
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
        contentText: "Atom full text.",
        externalId: "tag:example.com,2026:atom-1",
        publishedAt: new Date("2026-06-22T11:00:00.000Z"),
        summary: "Atom summary",
        title: "Atom Entry",
        url: "https://example.com/posts/atom-entry",
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
})

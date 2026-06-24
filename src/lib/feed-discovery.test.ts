import { describe, expect, it } from "vitest"

import {
  extractFeedCandidatesFromHtml,
  parseFeedXml,
} from "./feed-discovery"

describe("feed discovery helpers", () => {
  it("parses RSS metadata", () => {
    const feed = parseFeedXml(
      `<?xml version="1.0"?>
      <rss version="2.0">
        <channel>
          <title>Example RSS</title>
          <link>https://example.com</link>
          <description>Readable updates</description>
          <language>en-US</language>
        </channel>
      </rss>`,
      "https://example.com/rss.xml"
    )

    expect(feed).toMatchObject({
      format: "rss",
      title: "Example RSS",
      siteUrl: "https://example.com/",
      description: "Readable updates",
      language: "en-US",
    })
  })

  it("parses Atom metadata", () => {
    const feed = parseFeedXml(
      `<?xml version="1.0"?>
      <feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en">
        <title>Example Atom</title>
        <subtitle>Atom updates</subtitle>
        <link rel="self" href="https://example.com/atom.xml" />
        <link rel="alternate" href="https://example.com/" />
      </feed>`,
      "https://example.com/atom.xml"
    )

    expect(feed).toMatchObject({
      format: "atom",
      title: "Example Atom",
      siteUrl: "https://example.com/",
      description: "Atom updates",
      language: "en",
    })
  })

  it("extracts alternate feed links and common feed paths", () => {
    const candidates = extractFeedCandidatesFromHtml(
      `<html>
        <head>
          <link rel="alternate" type="application/rss+xml" href="/rss.xml" />
          <link rel="alternate stylesheet" href="/theme.css" />
          <link rel="alternate" type="application/atom+xml" href="https://feeds.example.com/main" />
        </head>
      </html>`,
      "https://example.com/articles/today"
    )

    expect(candidates.slice(0, 2)).toEqual([
      "https://example.com/rss.xml",
      "https://feeds.example.com/main",
    ])
    expect(candidates).toContain("https://example.com/feed")
    expect(candidates).toContain("https://example.com/atom.xml")
  })

  it("rejects non-feed XML", () => {
    expect(() =>
      parseFeedXml("<html><title>Nope</title></html>", "https://example.com")
    ).toThrow("The URL did not return a valid RSS or Atom feed")
  })
})

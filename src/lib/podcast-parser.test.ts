import { describe, expect, it } from "vitest"

import { parsePodcastFeed, PodcastParseError } from "./podcast-parser"

const podcastXml = `<?xml version="1.0"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>Example Podcast</title>
    <link>https://example.com/show</link>
    <description>A show about examples.</description>
    <language>en-us</language>
    <itunes:author>Example Network</itunes:author>
    <itunes:image href="https://example.com/show.jpg" />
    <item>
      <guid>episode-1</guid>
      <title>First Episode</title>
      <link>https://example.com/episode-1</link>
      <description>Episode description.</description>
      <pubDate>Mon, 29 Jun 2026 12:00:00 GMT</pubDate>
      <itunes:duration>01:02:03</itunes:duration>
      <enclosure url="https://cdn.example.com/episode-1.mp3" type="audio/mpeg" length="12345" />
    </item>
  </channel>
</rss>`

describe("parsePodcastFeed", () => {
  it("parses podcast metadata and audio episodes", () => {
    const podcast = parsePodcastFeed(podcastXml, "https://example.com/feed.xml")

    expect(podcast).toMatchObject({
      artworkUrl: "https://example.com/show.jpg",
      author: "Example Network",
      description: "A show about examples.",
      feedUrl: "https://example.com/feed.xml",
      language: "en-us",
      siteUrl: "https://example.com/show",
      title: "Example Podcast",
    })
    expect(podcast.episodes).toEqual([
      expect.objectContaining({
        audioLengthBytes: BigInt(12345),
        audioType: "audio/mpeg",
        audioUrl: "https://cdn.example.com/episode-1.mp3",
        durationSeconds: 3723,
        externalId: "episode-1",
        publishedAt: new Date("2026-06-29T12:00:00.000Z"),
        title: "First Episode",
        url: "https://example.com/episode-1",
      }),
    ])
  })

  it("rejects RSS feeds without audio enclosures", () => {
    expect(() =>
      parsePodcastFeed(
        `<rss><channel><title>Text Feed</title><item><title>No Audio</title></item></channel></rss>`,
        "https://example.com/feed.xml"
      )
    ).toThrow(PodcastParseError)
  })

  it("accepts missing type enclosures with known audio extensions", () => {
    const podcast = parsePodcastFeed(
      `<rss><channel><title>Show</title><item><title>Episode</title><enclosure url="https://cdn.example.com/episode.mp3" /></item></channel></rss>`,
      "https://example.com/feed.xml"
    )

    expect(podcast.episodes[0]).toMatchObject({
      audioUrl: "https://cdn.example.com/episode.mp3",
      title: "Episode",
    })
  })

  it("rejects missing type enclosures with non-audio extensions", () => {
    expect(() =>
      parsePodcastFeed(
        `<rss><channel><title>Show</title><item><title>Episode</title><enclosure url="https://cdn.example.com/notes.pdf" /></item></channel></rss>`,
        "https://example.com/feed.xml"
      )
    ).toThrow("No audio episodes were found in that podcast feed.")
  })

  it("falls back to the audio URL when guid id and link are missing", () => {
    const podcast = parsePodcastFeed(
      `<rss><channel><title>Show</title><item><title>Episode</title><enclosure url="https://cdn.example.com/episode.mp3" type="audio/mpeg" /></item></channel></rss>`,
      "https://example.com/feed.xml"
    )

    expect(podcast.episodes[0]?.externalId).toBe(
      "https://cdn.example.com/episode.mp3"
    )
  })

  it("parses Atom feeds with enclosure links", () => {
    const podcast = parsePodcastFeed(
      `<feed xmlns="http://www.w3.org/2005/Atom">
        <title>Atom Show</title>
        <link rel="ALTERNATE" href="https://example.com/show" />
        <entry>
          <id>atom-episode</id>
          <title>Atom Episode</title>
          <link rel="ENCLOSURE" href="https://cdn.example.com/atom.m4a" type="audio/mp4" length="99" />
        </entry>
      </feed>`,
      "https://example.com/feed.xml"
    )

    expect(podcast.siteUrl).toBe("https://example.com/show")
    expect(podcast.episodes[0]).toMatchObject({
      audioLengthBytes: BigInt(99),
      audioType: "audio/mp4",
      audioUrl: "https://cdn.example.com/atom.m4a",
      externalId: "atom-episode",
      title: "Atom Episode",
    })
  })

  it("includes sibling RDF item entries as episodes", () => {
    const podcast = parsePodcastFeed(
      `<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
        <channel>
          <title>RDF Show</title>
        </channel>
        <item>
          <title>RDF Episode</title>
          <enclosure url="https://cdn.example.com/rdf.mp3" type="audio/mpeg" />
        </item>
      </rdf:RDF>`,
      "https://example.com/feed.xml"
    )

    expect(podcast.episodes[0]).toMatchObject({
      audioUrl: "https://cdn.example.com/rdf.mp3",
      title: "RDF Episode",
    })
  })

  it("normalizes relative artwork links and enclosures against the feed URL", () => {
    const podcast = parsePodcastFeed(
      `<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
        <channel>
          <title>Relative Show</title>
          <link>/show</link>
          <itunes:image href="/art/show.jpg" />
          <item>
            <guid>relative-episode</guid>
            <title>Relative Episode</title>
            <link>episodes/1</link>
            <enclosure url="../audio/episode.mp3" type="audio/mpeg" />
          </item>
        </channel>
      </rss>`,
      "https://example.com/podcasts/feed.xml"
    )

    expect(podcast).toMatchObject({
      artworkUrl: "https://example.com/art/show.jpg",
      siteUrl: "https://example.com/show",
    })
    expect(podcast.episodes[0]).toMatchObject({
      audioUrl: "https://example.com/audio/episode.mp3",
      url: "https://example.com/podcasts/episodes/1",
    })
  })

  it("leaves invalid duration date and length undefined", () => {
    const podcast = parsePodcastFeed(
      `<rss><channel><title>Show</title><item>
        <title>Episode</title>
        <pubDate>not a real date</pubDate>
        <itunes:duration>01:99:03</itunes:duration>
        <enclosure url="https://cdn.example.com/episode.mp3" type="audio/mpeg" length="abc" />
      </item></channel></rss>`,
      "https://example.com/feed.xml"
    )

    expect(podcast.episodes[0]).toMatchObject({
      audioLengthBytes: undefined,
      durationSeconds: undefined,
      publishedAt: undefined,
    })
  })

  it("ignores non-audio enclosures and chooses the audio enclosure", () => {
    const podcast = parsePodcastFeed(
      `<rss><channel><title>Show</title><item>
        <title>Episode</title>
        <enclosure url="https://cdn.example.com/notes.pdf" type="application/pdf" />
        <enclosure url="https://cdn.example.com/episode.wav" type="audio/wav" />
      </item></channel></rss>`,
      "https://example.com/feed.xml"
    )

    expect(podcast.episodes[0]?.audioUrl).toBe(
      "https://cdn.example.com/episode.wav"
    )
  })
})

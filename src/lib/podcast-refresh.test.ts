import { describe, expect, it, vi } from "vitest"

import { PodcastRefreshError, refreshPodcastWithClient } from "./podcast-refresh"

function createStore(feedUrl = "https://example.com/podcast.xml") {
  return {
    $transaction: vi.fn(async (operations: Array<Promise<unknown>>) =>
      Promise.all(operations)
    ),
    podcast: {
      findUnique: vi.fn().mockResolvedValue({
        consecutiveFailures: 0,
        etag: null,
        feedUrl,
        id: "podcast-1",
        lastModified: null,
        refreshIntervalMinutes: 60,
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    podcastEpisode: {
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
  }
}

const podcastXml = `<?xml version="1.0"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>Show</title>
    <description>Show description</description>
    <link>https://example.com/show</link>
    <language>en-us</language>
    <itunes:author>Show Host</itunes:author>
    <itunes:image href="https://example.com/show.jpg" />
    <item>
      <guid>ep-1</guid>
      <title>Episode</title>
      <link>https://example.com/episode</link>
      <description>Episode description</description>
      <content:encoded><![CDATA[<p>Episode notes</p>]]></content:encoded>
      <itunes:summary>Episode summary</itunes:summary>
      <itunes:duration>1:02:03</itunes:duration>
      <itunes:image href="https://example.com/episode.jpg" />
      <pubDate>Mon, 29 Jun 2026 11:30:00 GMT</pubDate>
      <enclosure url="https://cdn.example.com/ep.mp3" type="audio/mpeg" length="12345" />
    </item>
  </channel>
</rss>`

describe("refreshPodcastWithClient", () => {
  it("imports new podcast episodes in a batch, updates metadata, and clears errors", async () => {
    const store = createStore()
    const now = new Date("2026-06-29T12:00:00.000Z")

    const result = await refreshPodcastWithClient({
      podcastId: "podcast-1",
      fetchText: vi.fn().mockResolvedValue({
        contentType: "application/rss+xml",
        text: podcastXml,
        url: new URL("https://redirected.example.com/podcast.xml"),
      }),
      now: () => now,
      random: () => 0.5,
      store,
    })

    expect(result).toEqual(
      expect.objectContaining({ episodeCount: 1, podcastId: "podcast-1" })
    )
    expect(result.metrics).toEqual(
      expect.objectContaining({
        conditionalHit: false,
        insertedCount: 1,
        parsedCount: 1,
        skippedCount: 0,
        updatedCount: 0,
      })
    )
    expect(store.podcastEpisode.createMany).toHaveBeenCalledWith({
      data: [
        {
          audioLengthBytes: BigInt(12345),
          audioType: "audio/mpeg",
          audioUrl: "https://cdn.example.com/ep.mp3",
          contentHtml: "<p>Episode notes</p>",
          contentText: "Episode summary",
          description: "Episode description",
          durationSeconds: 3723,
          externalId: "ep-1",
          imageUrl: "https://example.com/episode.jpg",
          podcastId: "podcast-1",
          publishedAt: new Date("2026-06-29T11:30:00.000Z"),
          title: "Episode",
          url: "https://example.com/episode",
        },
      ],
      skipDuplicates: true,
    })
    expect(store.podcastEpisode.update).not.toHaveBeenCalled()
    expect(store.podcast.update).toHaveBeenLastCalledWith({
      data: {
        artworkUrl: "https://example.com/show.jpg",
        author: "Show Host",
        description: "Show description",
        language: "en-us",
        lastError: null,
        lastFailedAt: null,
        lastFetchedAt: now,
        lastSuccessfulFetchAt: now,
        consecutiveFailures: 0,
        nextFetchAt: new Date("2026-06-29T13:00:00.000Z"),
        siteUrl: "https://example.com/show",
        title: "Show",
      },
      where: { id: "podcast-1" },
    })
  })

  it("updates existing episodes in a bounded transaction batch", async () => {
    const store = createStore()
    store.podcastEpisode.findMany.mockResolvedValue([{ externalId: "ep-1" }])

    await refreshPodcastWithClient({
      podcastId: "podcast-1",
      fetchText: vi.fn().mockResolvedValue({
        contentType: "application/rss+xml",
        text: podcastXml,
        url: new URL("https://example.com/podcast.xml"),
      }),
      store,
    })

    expect(store.podcastEpisode.update).toHaveBeenCalledWith({
      data: expect.objectContaining({
        audioUrl: "https://cdn.example.com/ep.mp3",
        title: "Episode",
      }),
      where: {
        podcastId_externalId: {
          externalId: "ep-1",
          podcastId: "podcast-1",
        },
      },
    })
    expect(store.$transaction).toHaveBeenCalledTimes(1)
  })

  it("uses stored validators and skips parsing after a 304 response", async () => {
    const store = createStore()
    store.podcast.findUnique.mockResolvedValue({
      consecutiveFailures: 0,
      etag: 'W/"podcast-v1"',
      feedUrl: "https://example.com/podcast.xml",
      id: "podcast-1",
      lastModified: "Mon, 29 Jun 2026 11:30:00 GMT",
      refreshIntervalMinutes: 60,
    })
    const fetchText = vi.fn().mockResolvedValue({
      bytes: 0,
      contentType: "",
      etag: 'W/"podcast-v2"',
      notModified: true,
      status: 304,
      text: "",
      url: new URL("https://example.com/podcast.xml"),
    })

    const result = await refreshPodcastWithClient({
      podcastId: "podcast-1",
      fetchText,
      store,
    })

    expect(fetchText).toHaveBeenCalledWith(new URL("https://example.com/podcast.xml"), {
      allowNotModified: true,
      ifModifiedSince: "Mon, 29 Jun 2026 11:30:00 GMT",
      ifNoneMatch: 'W/"podcast-v1"',
    })
    expect(store.podcastEpisode.createMany).not.toHaveBeenCalled()
    expect(result).toEqual(
      expect.objectContaining({ episodeCount: 0, podcastId: "podcast-1" })
    )
    expect(result.metrics).toEqual(
      expect.objectContaining({
        bytes: 0,
        conditionalHit: true,
        parsedCount: 0,
      })
    )
    expect(store.podcast.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ etag: 'W/"podcast-v2"' }),
      })
    )
  })

  it("records failed health when fetch or parsing fails", async () => {
    const store = createStore()
    const now = new Date("2026-06-29T12:00:00.000Z")
    const fetchText = vi.fn().mockRejectedValue(new Error("network down"))

    await expect(
      refreshPodcastWithClient({
        podcastId: "podcast-1",
        fetchText,
        now: () => now,
        random: () => 0.5,
        store,
      })
    ).rejects.toThrow("network down")

    expect(store.podcastEpisode.createMany).not.toHaveBeenCalled()
    expect(store.podcast.update).toHaveBeenCalledWith({
      data: {
        lastError: "network down",
        lastFailedAt: now,
        lastFetchedAt: now,
        consecutiveFailures: 1,
        nextFetchAt: new Date("2026-06-29T14:00:00.000Z"),
      },
      where: { id: "podcast-1" },
    })
  })

  it("truncates failed health errors to 500 characters", async () => {
    const store = createStore()
    const now = new Date("2026-06-29T12:00:00.000Z")
    const longMessage = "x".repeat(501)

    await expect(
      refreshPodcastWithClient({
        podcastId: "podcast-1",
        fetchText: vi.fn().mockRejectedValue(new Error(longMessage)),
        now: () => now,
        random: () => 0.5,
        store,
      })
    ).rejects.toThrow(longMessage)

    expect(store.podcast.update).toHaveBeenCalledWith({
      data: {
        lastError: "x".repeat(500),
        lastFailedAt: now,
        lastFetchedAt: now,
        consecutiveFailures: 1,
        nextFetchAt: new Date("2026-06-29T14:00:00.000Z"),
      },
      where: { id: "podcast-1" },
    })
  })

  it("throws when the podcast is missing without recording health", async () => {
    const store = createStore()
    store.podcast.findUnique.mockResolvedValue(null)

    await expect(
      refreshPodcastWithClient({
        podcastId: "missing-podcast",
        store,
      })
    ).rejects.toEqual(new PodcastRefreshError("Podcast not found."))

    expect(store.podcast.update).not.toHaveBeenCalled()
    expect(store.podcastEpisode.createMany).not.toHaveBeenCalled()
  })
})

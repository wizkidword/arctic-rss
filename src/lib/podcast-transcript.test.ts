import { describe, expect, it, vi } from "vitest"

import {
  getPodcastEpisodeTranscriptForUser,
  PodcastTranscriptError,
  parsePodcastTranscript,
  type PodcastTranscriptCache,
} from "./podcast-transcript"
import { createHostRequestLimiter, FeedFetchError, UnsafeUrlError } from "./url-safety"

function createStore(reference: {
  transcriptLanguage: string | null
  transcriptRel: string | null
  transcriptType: string | null
  transcriptUrl: string | null
} | null) {
  return {
    podcastEpisode: {
      findFirst: vi.fn().mockResolvedValue(reference),
    },
  }
}

function createCache(): PodcastTranscriptCache {
  const values = new Map<string, string>()

  return {
    get: vi.fn(async (key) => values.get(key) ?? null),
    set: vi.fn(async (key, value) => {
      values.set(key, value)
      return "OK"
    }),
  }
}

function transcriptReference() {
  return {
    transcriptLanguage: "en",
    transcriptRel: "captions",
    transcriptType: "text/vtt",
    transcriptUrl: "https://publisher.example.com/episode.vtt",
  }
}

function transcriptResponse() {
  return {
    contentType: "text/vtt",
    text: "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello.",
    url: new URL("https://publisher.example.com/episode.vtt"),
  }
}

describe("parsePodcastTranscript", () => {
  it("parses WebVTT cues with timestamps", () => {
    expect(
      parsePodcastTranscript(
        "WEBVTT\n\n1\n00:00:01.500 --> 00:00:04.000 align:start\nHello <v Host>world</v>.\n\n00:01:00.000 --> 00:01:02.000\nSecond cue.",
        "text/vtt"
      )
    ).toEqual([
      { endSeconds: 4, startSeconds: 1.5, text: "Hello world." },
      { endSeconds: 62, startSeconds: 60, text: "Second cue." },
    ])
  })

  it("parses SubRip and plain text without inventing timestamps", () => {
    expect(
      parsePodcastTranscript(
        "1\n00:00:01,000 --> 00:00:02,500\nA first cue.\n\n2\n00:00:03,000 --> 00:00:04,000\nA second cue.",
        "application/x-subrip"
      )
    ).toEqual([
      { endSeconds: 2.5, startSeconds: 1, text: "A first cue." },
      { endSeconds: 4, startSeconds: 3, text: "A second cue." },
    ])
    expect(parsePodcastTranscript("First paragraph.\n\nSecond paragraph.", "text/plain")).toEqual([
      { text: "First paragraph." },
      { text: "Second paragraph." },
    ])
  })

  it("uses the shared sanitizer for publisher-supplied caption text", () => {
    expect(
      parsePodcastTranscript(
        "00:00:01.000 --> 00:00:02.000\nVisible <v Host>caption</v> <script>alert('no')</script>\n\n00:00:03.000 --> 00:00:04.000\nUnclosed <script",
        "text/vtt"
      )
    ).toEqual([
      { endSeconds: 2, startSeconds: 1, text: "Visible caption" },
      { endSeconds: 4, startSeconds: 3, text: "Unclosed script" },
    ])
  })
})

describe("getPodcastEpisodeTranscriptForUser", () => {
  it("authorizes the subscriber before safely fetching a publisher transcript", async () => {
    const store = createStore(transcriptReference())
    const fetchText = vi.fn().mockResolvedValue(transcriptResponse())

    await expect(
      getPodcastEpisodeTranscriptForUser({
        cache: createCache(),
        episodeId: "episode-1",
        fetchText,
        store,
        userId: "user-1",
      })
    ).resolves.toEqual({
      cues: [{ endSeconds: 2, startSeconds: 1, text: "Hello." }],
      isCaptions: true,
      language: "en",
      type: "text/vtt",
    })

    expect(store.podcastEpisode.findFirst).toHaveBeenCalledWith({
      select: {
        transcriptLanguage: true,
        transcriptRel: true,
        transcriptType: true,
        transcriptUrl: true,
      },
      where: {
        id: "episode-1",
        podcast: { subscriptions: { some: { userId: "user-1" } } },
      },
    })
    expect(fetchText).toHaveBeenCalledWith(
      new URL("https://publisher.example.com/episode.vtt"),
      expect.objectContaining({ maxBytes: 1024 * 1024 })
    )
  })

  it("does not fetch unavailable or unsupported transcript references", async () => {
    const unavailableStore = createStore(null)
    const unavailableFetch = vi.fn()

    await expect(
      getPodcastEpisodeTranscriptForUser({
        cache: createCache(),
        episodeId: "episode-1",
        fetchText: unavailableFetch,
        store: unavailableStore,
        userId: "user-1",
      })
    ).resolves.toBeNull()
    expect(unavailableFetch).not.toHaveBeenCalled()

    const unsupportedStore = createStore({
      transcriptLanguage: null,
      transcriptRel: null,
      transcriptType: "text/html",
      transcriptUrl: "https://publisher.example.com/episode.html",
    })
    const unsupportedFetch = vi.fn()

    await expect(
      getPodcastEpisodeTranscriptForUser({
        cache: createCache(),
        episodeId: "episode-1",
        fetchText: unsupportedFetch,
        store: unsupportedStore,
        userId: "user-1",
      })
    ).rejects.toMatchObject({ reason: "unsupported_format" })
    expect(unsupportedFetch).not.toHaveBeenCalled()
  })

  it("reuses a bounded positive cache entry only after each subscriber is authorized", async () => {
    const cache = createCache()
    const fetchText = vi.fn().mockResolvedValue(transcriptResponse())

    await expect(
      getPodcastEpisodeTranscriptForUser({
        cache,
        episodeId: "episode-1",
        fetchText,
        store: createStore(transcriptReference()),
        userId: "user-1",
      })
    ).resolves.toMatchObject({ cues: [{ text: "Hello." }] })
    await expect(
      getPodcastEpisodeTranscriptForUser({
        cache,
        episodeId: "episode-1",
        fetchText,
        store: createStore(transcriptReference()),
        userId: "user-2",
      })
    ).resolves.toMatchObject({ cues: [{ text: "Hello." }] })

    expect(fetchText).toHaveBeenCalledOnce()
    expect(cache.set).toHaveBeenCalledWith(
      expect.stringMatching(/^arctic-rss:podcast-transcript:v1:[a-f0-9]{64}$/),
      expect.any(String),
      "PX",
      120_000
    )
  })

  it("uses a shorter negative cache for transient upstream failures", async () => {
    const cache = createCache()
    const fetchText = vi
      .fn()
      .mockRejectedValue(new FeedFetchError("The upstream transcript is unavailable."))

    const request = () =>
      getPodcastEpisodeTranscriptForUser({
        cache,
        episodeId: "episode-1",
        fetchText,
        store: createStore(transcriptReference()),
        userId: "user-1",
      })

    await expect(request()).rejects.toMatchObject({ reason: "upstream_unavailable" })
    await expect(request()).rejects.toMatchObject({ reason: "upstream_unavailable" })

    expect(fetchText).toHaveBeenCalledOnce()
    expect(cache.set).toHaveBeenCalledWith(expect.any(String), expect.any(String), "PX", 30_000)
  })

  it("classifies blocked redirects and malformed timed transcripts without exposing a URL", async () => {
    const redirectBlocked = getPodcastEpisodeTranscriptForUser({
      cache: createCache(),
      episodeId: "episode-1",
      fetchText: vi.fn().mockRejectedValue(new UnsafeUrlError("Blocked redirect.")),
      store: createStore(transcriptReference()),
      userId: "user-1",
    })
    const malformedTranscript = getPodcastEpisodeTranscriptForUser({
      cache: createCache(),
      episodeId: "episode-1",
      fetchText: vi.fn().mockResolvedValue({
        ...transcriptResponse(),
        text: "WEBVTT\n\nThis is not a timed cue.",
      }),
      store: createStore(transcriptReference()),
      userId: "user-1",
    })

    await expect(redirectBlocked).rejects.toMatchObject({ reason: "unsafe_destination" })
    await expect(malformedTranscript).rejects.toMatchObject({ reason: "parse_failure" })
  })

  it("classifies bounded fetch timeouts and oversized responses", async () => {
    const timeout = getPodcastEpisodeTranscriptForUser({
      cache: createCache(),
      episodeId: "episode-1",
      fetchText: vi.fn().mockRejectedValue(new FeedFetchError("The URL request timed out.")),
      store: createStore(transcriptReference()),
      userId: "user-1",
    })
    const oversizedResponse = getPodcastEpisodeTranscriptForUser({
      cache: createCache(),
      episodeId: "episode-1",
      fetchText: vi
        .fn()
        .mockRejectedValue(new FeedFetchError("The response is too large to inspect safely.")),
      store: createStore(transcriptReference()),
      userId: "user-1",
    })

    await expect(timeout).rejects.toBeInstanceOf(PodcastTranscriptError)
    await expect(timeout).rejects.toMatchObject({ reason: "timeout" })
    await expect(oversizedResponse).rejects.toMatchObject({ reason: "oversized_response" })
  })

  it("passes the global transcript semaphore into the safe fetcher", async () => {
    const fetchText = vi.fn().mockResolvedValue(transcriptResponse())
    const limiter = createHostRequestLimiter(1)

    await getPodcastEpisodeTranscriptForUser({
      cache: createCache(),
      episodeId: "episode-1",
      fetchText,
      outboundRequestLimiter: limiter,
      store: createStore(transcriptReference()),
      userId: "user-1",
    })

    expect(fetchText).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({ globalRequestLimiter: limiter })
    )
  })

  it("does not create a cache entry when subscription authorization fails", async () => {
    const cache = createCache()
    const fetchText = vi.fn()

    await expect(
      getPodcastEpisodeTranscriptForUser({
        cache,
        episodeId: "episode-1",
        fetchText,
        store: createStore(null),
        userId: "user-without-subscription",
      })
    ).resolves.toBeNull()

    expect(cache.get).not.toHaveBeenCalled()
    expect(cache.set).not.toHaveBeenCalled()
    expect(fetchText).not.toHaveBeenCalled()
  })
})

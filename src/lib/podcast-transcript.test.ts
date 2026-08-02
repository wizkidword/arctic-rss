import { describe, expect, it, vi } from "vitest"

import {
  getPodcastEpisodeTranscriptForUser,
  parsePodcastTranscript,
} from "./podcast-transcript"

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
})

describe("getPodcastEpisodeTranscriptForUser", () => {
  it("authorizes the subscriber before safely fetching a publisher transcript", async () => {
    const store = createStore({
      transcriptLanguage: "en",
      transcriptRel: "captions",
      transcriptType: "text/vtt",
      transcriptUrl: "https://publisher.example.com/episode.vtt",
    })
    const fetchText = vi.fn().mockResolvedValue({
      contentType: "text/vtt",
      text: "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello.",
      url: new URL("https://publisher.example.com/episode.vtt"),
    })

    await expect(
      getPodcastEpisodeTranscriptForUser({
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
        episodeId: "episode-1",
        fetchText: unsupportedFetch,
        store: unsupportedStore,
        userId: "user-1",
      })
    ).resolves.toBeNull()
    expect(unsupportedFetch).not.toHaveBeenCalled()
  })
})

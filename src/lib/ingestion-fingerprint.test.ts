import { describe, expect, it } from "vitest"

import {
  articleIngestionFingerprint,
  INGESTION_FINGERPRINT_VERSION,
  podcastEpisodeIngestionFingerprint,
} from "./ingestion-fingerprint"

describe("ingestion fingerprints", () => {
  it("uses a versioned, stable article representation with explicit nulls", () => {
    const first = articleIngestionFingerprint({
      contentText: "Cafe\u0301",
      publishedAt: new Date("2026-08-08T12:34:56.000Z"),
      title: "Article",
      url: "https://example.com/article",
    })
    const second = articleIngestionFingerprint({
      canonicalUrl: undefined,
      contentText: "Café",
      publishedAt: new Date("2026-08-08T12:34:56.000Z"),
      title: "Article",
      url: "https://example.com/article",
    })

    expect(first).toBe(second)
    expect(first).toMatch(new RegExp(`^${INGESTION_FINGERPRINT_VERSION}:`))
    expect(first).toHaveLength(67)
  })

  it("changes when an article correction changes a mutable field", () => {
    const original = articleIngestionFingerprint({
      title: "Original title",
      url: "https://example.com/article",
    })
    const corrected = articleIngestionFingerprint({
      title: "Corrected title",
      url: "https://example.com/article",
    })

    expect(corrected).not.toBe(original)
  })

  it("detects canonical URL, body, and publication-time corrections", () => {
    const original = articleIngestionFingerprint({
      canonicalUrl: "https://example.com/original",
      contentText: "Original body",
      publishedAt: new Date("2026-08-08T00:00:00.000Z"),
      title: "Article",
      url: "https://example.com/article",
    })
    const corrected = articleIngestionFingerprint({
      canonicalUrl: "https://example.com/corrected",
      contentText: "Corrected body",
      publishedAt: new Date("2026-08-08T00:01:00.000Z"),
      title: "Article",
      url: "https://example.com/article",
    })

    expect(corrected).not.toBe(original)
  })

  it("covers nullable podcast transcript metadata and bigint audio lengths", () => {
    const withoutTranscript = podcastEpisodeIngestionFingerprint({
      audioLengthBytes: BigInt(1234),
      audioUrl: "https://cdn.example.com/episode.mp3",
      title: "Episode",
    })
    const withTranscript = podcastEpisodeIngestionFingerprint({
      audioLengthBytes: BigInt(1234),
      audioUrl: "https://cdn.example.com/episode.mp3",
      title: "Episode",
      transcriptUrl: "https://cdn.example.com/episode.vtt",
    })

    expect(withTranscript).not.toBe(withoutTranscript)
  })
})

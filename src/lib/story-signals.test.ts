import { describe, expect, it } from "vitest"

import {
  normalizeStoryTitle,
  normalizeStoryUrl,
  storyIdentitySignals,
  storyPairEvidence,
} from "./story-signals"

describe("story identity signals", () => {
  it("prefers a publisher canonical URL and falls back to the article URL", () => {
    expect(
      storyIdentitySignals({
        canonicalUrl: "https://example.com/story#publisher-fragment",
        title: "Example story",
        url: "https://example.com/story?utm_source=feed",
      })
    ).toMatchObject({
      canonicalUrl: "https://example.com/story",
      normalizedTitle: "example story",
    })

    expect(
      storyIdentitySignals({
        title: "Example story",
        url: "https://EXAMPLE.com/story?utm_source=feed&page=2#top",
      }).canonicalUrl
    ).toBe("https://example.com/story?page=2")
  })

  it("keeps meaningful query parameters while removing only standard trackers", () => {
    expect(
      normalizeStoryUrl(
        "https://example.com/story?topic=climate&utm_campaign=briefing&fbclid=abc"
      )
    ).toBe("https://example.com/story?topic=climate")
  })

  it("does not use unsafe or malformed URLs as a story identity signal", () => {
    expect(normalizeStoryUrl("mailto:editor@example.com")).toBeNull()
    expect(normalizeStoryUrl("https://reader:secret@example.com/story")).toBeNull()
    expect(normalizeStoryUrl("not a url")).toBeNull()
  })

  it("normalizes Unicode, punctuation, and whitespace without guessing at title meaning", () => {
    expect(normalizeStoryTitle("  U.S. – Iran: What's Next?  ")).toBe(
      "us iran whats next"
    )
    expect(normalizeStoryTitle("   ")).toBeNull()
  })
})

describe("story pair evidence", () => {
  it("records every transparent matching signal without returning a hidden score or grouping decision", () => {
    const evidence = storyPairEvidence(
      {
        canonicalUrl: "https://example.com/story?utm_source=wire",
        publishedAt: new Date("2026-07-28T10:00:00.000Z"),
        title: "U.S. – Iran: What's Next?",
        url: "https://wire.example/story",
      },
      {
        publishedAt: new Date("2026-07-29T09:00:00.000Z"),
        title: "US Iran Whats Next",
        url: "https://example.com/story",
      },
      { timeWindowMs: 48 * 60 * 60 * 1000 }
    )

    expect(evidence).toEqual({
      canonicalUrlMatches: true,
      normalizedTitleMatches: true,
      publishedWithinWindow: true,
      reasons: [
        {
          code: "canonical_url",
          description: "Both articles resolve to the same canonical URL.",
        },
        {
          code: "normalized_title",
          description: "Both articles have the same normalized title.",
        },
        {
          code: "publication_time_window",
          description:
            "Both articles were published within the configured time window.",
        },
      ],
    })
    expect(evidence).not.toHaveProperty("score")
    expect(evidence).not.toHaveProperty("isMatch")
  })

  it("does not treat the time window alone as a URL or title match", () => {
    expect(
      storyPairEvidence(
        {
          publishedAt: new Date("2026-07-28T10:00:00.000Z"),
          title: "Different story",
          url: "https://example.com/one",
        },
        {
          publishedAt: new Date("2026-07-28T11:00:00.000Z"),
          title: "Another story",
          url: "https://example.com/two",
        },
        { timeWindowMs: 2 * 60 * 60 * 1000 }
      )
    ).toMatchObject({
      canonicalUrlMatches: false,
      normalizedTitleMatches: false,
      publishedWithinWindow: true,
    })
  })

  it("requires valid timestamps and a non-negative window", () => {
    expect(
      storyPairEvidence(
        {
          publishedAt: new Date("invalid"),
          title: "Story",
          url: "https://example.com/story",
        },
        {
          publishedAt: new Date("2026-07-28T10:00:00.000Z"),
          title: "Story",
          url: "https://example.com/story",
        },
        { timeWindowMs: -1 }
      ).publishedWithinWindow
    ).toBe(false)
  })
})

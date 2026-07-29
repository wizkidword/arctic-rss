import { describe, expect, it } from "vitest"

import {
  buildStoryClusterCandidates,
  STORY_CLUSTER_POLICY_VERSION,
  STORY_CLUSTER_TITLE_TIME_WINDOW_MS,
} from "./story-cluster-policy"

const articles = [
  {
    canonicalUrl: "https://publisher.example/story?utm_source=feed",
    id: "article-canonical-a",
    publishedAt: null,
    title: "Publisher headline",
    url: "https://reader.example/outbound-a",
  },
  {
    canonicalUrl: "https://publisher.example/story",
    id: "article-canonical-b",
    publishedAt: null,
    title: "Different syndicated headline",
    url: "https://reader.example/outbound-b",
  },
  {
    id: "article-title-a",
    publishedAt: new Date("2026-07-28T12:00:00.000Z"),
    title: "Arctic News: Event Update!",
    url: "https://first.example/event",
  },
  {
    id: "article-title-b",
    publishedAt: new Date(
      new Date("2026-07-28T12:00:00.000Z").getTime() +
        STORY_CLUSTER_TITLE_TIME_WINDOW_MS
    ),
    title: "arctic news event update",
    url: "https://second.example/event",
  },
  {
    id: "article-title-late",
    publishedAt: new Date(
      new Date("2026-07-28T12:00:00.000Z").getTime() +
        STORY_CLUSTER_TITLE_TIME_WINDOW_MS +
        1
    ),
    title: "Arctic News Event Update",
    url: "https://third.example/event",
  },
  {
    id: "article-unrelated",
    publishedAt: new Date("2026-07-28T12:00:00.000Z"),
    title: "Different coverage",
    url: "https://unrelated.example/event",
  },
]

describe("buildStoryClusterCandidates", () => {
  it("groups exact canonical URL matches even without publication dates", () => {
    const candidates = buildStoryClusterCandidates(articles)

    expect(candidates).toContainEqual(
      expect.objectContaining({
        algorithmVersion: STORY_CLUSTER_POLICY_VERSION,
        evidence: [
          {
            leftArticleId: "article-canonical-a",
            rightArticleId: "article-canonical-b",
            signal: "CANONICAL_URL",
          },
        ],
        memberArticleIds: ["article-canonical-a", "article-canonical-b"],
      })
    )
  })

  it("groups normalized-title matches only when they are within the approved 72-hour window", () => {
    const candidates = buildStoryClusterCandidates(articles)

    expect(candidates).toContainEqual(
      expect.objectContaining({
        evidence: [
          {
            leftArticleId: "article-title-a",
            rightArticleId: "article-title-b",
            signal: "NORMALIZED_TITLE",
          },
          {
            leftArticleId: "article-title-a",
            rightArticleId: "article-title-b",
            signal: "PUBLICATION_TIME_WINDOW",
          },
        ],
        memberArticleIds: ["article-title-a", "article-title-b"],
      })
    )
    expect(candidates.flatMap((candidate) => candidate.memberArticleIds)).not.toContain(
      "article-title-late"
    )
  })

  it("keeps a stable candidate key and evidence order regardless of input order", () => {
    const forward = buildStoryClusterCandidates(articles)
    const reverse = buildStoryClusterCandidates([...articles].reverse())

    expect(reverse).toEqual(forward)
  })

  it("does not group articles by publication time alone", () => {
    const candidates = buildStoryClusterCandidates(articles)

    expect(candidates.flatMap((candidate) => candidate.memberArticleIds)).not.toContain(
      "article-unrelated"
    )
  })

  it("rejects duplicate article ids before candidate formation", () => {
    expect(() => buildStoryClusterCandidates([articles[0], articles[0]])).toThrow(
      "cannot repeat"
    )
  })
})

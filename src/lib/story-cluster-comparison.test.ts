import { describe, expect, it } from "vitest"

import { buildStoryClusterTimelineComparison } from "./story-cluster-comparison"

describe("buildStoryClusterTimelineComparison", () => {
  it("orders cited sources by known publication time and keeps unknown dates last", () => {
    const result = buildStoryClusterTimelineComparison([
      {
        articleId: "article-latest",
        feedTitle: "Latest Source",
        publishedAt: "2026-07-28T12:00:00.000Z",
        title: "Later headline",
        url: "https://latest.example/story",
      },
      {
        articleId: "article-unknown",
        feedTitle: "Unknown Source",
        publishedAt: null,
        title: "Undated headline",
        url: "https://unknown.example/story",
      },
      {
        articleId: "article-first",
        feedTitle: "First Source",
        publishedAt: "2026-07-28T10:00:00.000Z",
        title: "Earlier headline",
        url: "https://first.example/story",
      },
    ])

    expect(result.firstKnownSource?.articleId).toBe("article-first")
    expect(result.latestKnownSource?.articleId).toBe("article-latest")
    expect(result.sourcesByPublication.map((source) => source.articleId)).toEqual([
      "article-first",
      "article-latest",
      "article-unknown",
    ])
  })

  it("does not invent a first or latest source when publication times are unavailable", () => {
    const result = buildStoryClusterTimelineComparison([
      {
        articleId: "article-b",
        feedTitle: "Second Source",
        publishedAt: "not-a-date",
        title: "Second headline",
        url: "https://second.example/story",
      },
      {
        articleId: "article-a",
        feedTitle: "First Source",
        publishedAt: null,
        title: "First headline",
        url: "https://first.example/story",
      },
    ])

    expect(result.firstKnownSource).toBeNull()
    expect(result.latestKnownSource).toBeNull()
    expect(result.sourcesByPublication.map((source) => source.articleId)).toEqual([
      "article-a",
      "article-b",
    ])
  })
})

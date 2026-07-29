import { describe, expect, it } from "vitest"

import { createStoryClusterVersionSnapshot } from "./story-cluster-history"

const members = [
  {
    articleId: "article-b",
    articleTitle: "Second source",
    articleUrl: "https://second.example/story",
    feedTitle: "Second Source",
    publishedAt: new Date("2026-07-28T12:00:00.000Z"),
  },
  {
    articleId: "article-a",
    articleTitle: "First source",
    articleUrl: "https://first.example/story",
    feedTitle: "First Source",
    publishedAt: new Date("2026-07-28T11:00:00.000Z"),
  },
]

describe("createStoryClusterVersionSnapshot", () => {
  it("creates a stable, explainable first version without scoring articles", () => {
    const snapshot = createStoryClusterVersionSnapshot({
      action: "CREATED",
      deduplicationKey: " initial-import ",
      evidence: [
        {
          leftArticleId: "article-b",
          rightArticleId: "article-a",
          signal: "NORMALIZED_TITLE",
        },
        {
          leftArticleId: "article-b",
          rightArticleId: "article-a",
          signal: "PUBLICATION_TIME_WINDOW",
        },
      ],
      members,
      previousVersionNumber: 0,
    })

    expect(snapshot).toEqual({
      action: "CREATED",
      deduplicationKey: "initial-import",
      evidence: [
        {
          leftArticleId: "article-a",
          rightArticleId: "article-b",
          signal: "NORMALIZED_TITLE",
        },
        {
          leftArticleId: "article-a",
          rightArticleId: "article-b",
          signal: "PUBLICATION_TIME_WINDOW",
        },
      ],
      members: [members[1], members[0]],
      version: 1,
    })
  })

  it("requires an idempotency key for a rerun", () => {
    expect(() =>
      createStoryClusterVersionSnapshot({
        action: "RERUN",
        evidence: [
          {
            leftArticleId: "article-a",
            rightArticleId: "article-b",
            signal: "CANONICAL_URL",
          },
        ],
        members,
        previousVersionNumber: 1,
      })
    ).toThrow("requires a deduplication key")
  })

  it("records a restoration as the next version after a dismissal", () => {
    const snapshot = createStoryClusterVersionSnapshot({
      action: "RESTORED",
      evidence: [
        {
          leftArticleId: "article-a",
          rightArticleId: "article-b",
          signal: "CANONICAL_URL",
        },
      ],
      members,
      previousVersionNumber: 2,
    })

    expect(snapshot.version).toBe(3)
    expect(snapshot.action).toBe("RESTORED")
  })

  it("rejects members that do not have a visible grouping reason", () => {
    expect(() =>
      createStoryClusterVersionSnapshot({
        action: "CREATED",
        evidence: [
          {
            leftArticleId: "article-a",
            rightArticleId: "article-b",
            signal: "CANONICAL_URL",
          },
        ],
        members: [
          ...members,
          {
            articleId: "article-c",
            articleTitle: "Unexplained source",
            articleUrl: "https://third.example/story",
            feedTitle: "Third Source",
            publishedAt: null,
          },
        ],
        previousVersionNumber: 0,
      })
    ).toThrow("Every cluster member")
  })

  it("rejects self-edges, unknown members, and repeated reasons", () => {
    const invalidCases = [
      {
        leftArticleId: "article-a",
        rightArticleId: "article-a",
        signal: "CANONICAL_URL" as const,
      },
      {
        leftArticleId: "article-a",
        rightArticleId: "article-missing",
        signal: "CANONICAL_URL" as const,
      },
    ]

    for (const evidence of invalidCases) {
      expect(() =>
        createStoryClusterVersionSnapshot({
          action: "CREATED",
          evidence: [evidence],
          members,
          previousVersionNumber: 0,
        })
      ).toThrow()
    }

    expect(() =>
      createStoryClusterVersionSnapshot({
        action: "CREATED",
        evidence: [
          {
            leftArticleId: "article-a",
            rightArticleId: "article-b",
            signal: "CANONICAL_URL",
          },
          {
            leftArticleId: "article-b",
            rightArticleId: "article-a",
            signal: "CANONICAL_URL",
          },
        ],
        members,
        previousVersionNumber: 0,
      })
    ).toThrow("cannot repeat")
  })
})

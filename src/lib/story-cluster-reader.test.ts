import { describe, expect, it, vi } from "vitest"

import { type ReaderArticle } from "./articles"
import {
  evaluateStoryClustersForArticleUserWithDependencies,
  listStoryClustersForArticleUserWithClient,
  listStoryClustersForArticlesUserWithClient,
  STORY_CLUSTER_READER_WINDOW_SIZE
} from "./story-cluster-reader"

describe("story cluster reader evaluation", () => {
  it("persists only the selected article's candidate from a capped reader window", async () => {
    const selectedArticle = createReaderArticle(
      "article-1",
      "Shared story",
      "story"
    )
    const persistCandidate = vi.fn().mockResolvedValue({
      created: true,
      dismissed: false
    })

    const result = await evaluateStoryClustersForArticleUserWithDependencies({
      articleId: selectedArticle.id,
      dependencies: {
        getReaderArticle: vi.fn().mockResolvedValue(selectedArticle),
        listReaderArticles: vi
          .fn()
          .mockResolvedValue([
            createReaderArticle("article-2", "Shared story", "story"),
            createReaderArticle("article-3", "Unrelated", "unrelated")
          ]),
        persistCandidate
      },
      userId: "user-1"
    })

    expect(result).toEqual({ created: true, dismissed: false, matched: true })
    expect(persistCandidate).toHaveBeenCalledWith({
      candidate: expect.objectContaining({
        memberArticleIds: ["article-1", "article-2"]
      }),
      userId: "user-1"
    })
  })

  it("does not reach beyond the declared reader window", async () => {
    const selectedArticle = createReaderArticle(
      "article-1",
      "Shared story",
      "story"
    )
    const persistCandidate = vi.fn()
    const readerArticles = Array.from(
      { length: STORY_CLUSTER_READER_WINDOW_SIZE },
      (_, index) =>
        createReaderArticle(
          `article-${index + 2}`,
          index === STORY_CLUSTER_READER_WINDOW_SIZE - 1
            ? "Shared story"
            : `Unrelated ${index}`,
          index === STORY_CLUSTER_READER_WINDOW_SIZE - 1
            ? "story"
            : `unrelated-${index}`
        )
    )

    const result = await evaluateStoryClustersForArticleUserWithDependencies({
      articleId: selectedArticle.id,
      dependencies: {
        getReaderArticle: vi.fn().mockResolvedValue(selectedArticle),
        listReaderArticles: vi.fn().mockResolvedValue(readerArticles),
        persistCandidate
      },
      userId: "user-1"
    })

    expect(result).toEqual({ created: false, dismissed: false, matched: false })
    expect(persistCandidate).not.toHaveBeenCalled()
  })
})

describe("story cluster reader presentation", () => {
  it("loads active groups that overlap a reader page with one bounded query", async () => {
    const findMany = vi.fn().mockResolvedValue([])

    await expect(
      listStoryClustersForArticlesUserWithClient({
        articleIds: ["article-1", "article-2", "article-1"],
        loadArticles: vi.fn(),
        store: { storyClusterVersion: { findMany } },
        userId: "user-1"
      })
    ).resolves.toEqual([])

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 24,
        where: expect.objectContaining({
          cluster: { status: "ACTIVE", userId: "user-1" },
          members: {
            some: {
              articleId: { in: ["article-1", "article-2"] }
            }
          }
        })
      })
    )
  })

  it("returns only current clusters whose members remain visible to the user", async () => {
    const store = {
      storyClusterVersion: {
        findMany: vi.fn().mockResolvedValue([
          {
            analyses: [],
            cluster: { currentVersionNumber: 1, id: "cluster-current" },
            evidence: [
              {
                leftMember: { articleId: "article-1" },
                rightMember: { articleId: "article-2" },
                signal: "CANONICAL_URL"
              }
            ],
            members: [
              { articleId: "article-1", id: "member-1" },
              { articleId: "article-2", id: "member-2" }
            ],
            version: 1
          },
          {
            analyses: [],
            cluster: { currentVersionNumber: 2, id: "cluster-stale" },
            evidence: [
              {
                leftMember: { articleId: "article-1" },
                rightMember: { articleId: "article-3" },
                signal: "CANONICAL_URL"
              }
            ],
            members: [
              { articleId: "article-1", id: "member-1" },
              { articleId: "article-3", id: "member-3" }
            ],
            version: 1
          }
        ])
      }
    }
    const loadArticles = vi
      .fn()
      .mockResolvedValue([
        createReaderArticle("article-1", "Current article", "current"),
        createReaderArticle("article-2", "Related article", "related")
      ])

    const clusters = await listStoryClustersForArticleUserWithClient({
      articleId: "article-1",
      loadArticles,
      store,
      userId: "user-1"
    })

    expect(clusters).toEqual([
      {
        analysis: null,
        id: "cluster-current",
        members: [
          {
            articleId: "article-1",
            feedTitle: "Example Feed",
            memberId: "member-1",
            publishedAt: "2026-07-28T12:00:00.000Z",
            title: "Current article",
            url: "https://example.com/current"
          },
          {
            articleId: "article-2",
            feedTitle: "Example Feed",
            memberId: "member-2",
            publishedAt: "2026-07-28T12:00:00.000Z",
            title: "Related article",
            url: "https://example.com/related"
          }
        ],
        reasons: ["CANONICAL_URL"]
      }
    ])
    expect(loadArticles).toHaveBeenCalledWith({
      articleIds: ["article-1", "article-2"],
      userId: "user-1"
    })
    expect(store.storyClusterVersion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 12,
        where: expect.objectContaining({
          cluster: { status: "ACTIVE", userId: "user-1" },
          members: { some: { articleId: "article-1" } }
        })
      })
    )
  })

  it("suppresses a cluster if an old snapshot member is no longer visible", async () => {
    const clusters = await listStoryClustersForArticleUserWithClient({
      articleId: "article-1",
      loadArticles: vi
        .fn()
        .mockResolvedValue([
          createReaderArticle("article-1", "Current article", "current")
        ]),
      store: {
        storyClusterVersion: {
          findMany: vi.fn().mockResolvedValue([
            {
              analyses: [],
              cluster: { currentVersionNumber: 1, id: "cluster-hidden-member" },
              evidence: [
                {
                  leftMember: { articleId: "article-1" },
                  rightMember: { articleId: "article-2" },
                  signal: "CANONICAL_URL"
                }
              ],
              members: [
                { articleId: "article-1", id: "member-1" },
                { articleId: "article-2", id: "member-2" }
              ],
              version: 1
            }
          ])
        }
      },
      userId: "user-1"
    })

    expect(clusters).toEqual([])
  })

  it("presents stored AI statements only with their visible snapshot citations", async () => {
    const clusters = await listStoryClustersForArticleUserWithClient({
      articleId: "article-1",
      loadArticles: vi
        .fn()
        .mockResolvedValue([
          createReaderArticle("article-1", "Current article", "current"),
          createReaderArticle("article-2", "Related article", "related")
        ]),
      store: {
        storyClusterVersion: {
          findMany: vi.fn().mockResolvedValue([
            {
              analyses: [
                {
                  claims: [
                    {
                      citations: [{ memberId: "member-1", position: 0 }],
                      kind: "NEW_FACT",
                      position: 0,
                      statement: "The later source adds a cited detail."
                    }
                  ],
                  model: "gpt-5.4-mini",
                  provider: "openai",
                  sourceCount: 2
                }
              ],
              cluster: { currentVersionNumber: 1, id: "cluster-current" },
              evidence: [
                {
                  leftMember: { articleId: "article-1" },
                  rightMember: { articleId: "article-2" },
                  signal: "CANONICAL_URL"
                }
              ],
              members: [
                { articleId: "article-1", id: "member-1" },
                { articleId: "article-2", id: "member-2" }
              ],
              version: 1
            }
          ])
        }
      },
      userId: "user-1"
    })

    expect(clusters[0]?.analysis).toEqual({
      claims: [
        {
          citations: ["member-1"],
          kind: "NEW_FACT",
          statement: "The later source adds a cited detail."
        }
      ],
      model: "gpt-5.4-mini",
      provider: "openai",
      sourceCount: 2
    })
  })
})

function createReaderArticle(
  id: string,
  title: string,
  path: string
): ReaderArticle {
  return {
    aiSummary: null,
    author: null,
    contentText: null,
    feedFaviconUrl: null,
    feedId: "feed-1",
    feedTitle: "Example Feed",
    id,
    imageUrl: null,
    isRead: false,
    isStarred: false,
    publishedAt: new Date("2026-07-28T12:00:00.000Z"),
    readAt: null,
    sanitizedContentHtml: null,
    starredAt: null,
    summary: null,
    title,
    url: `https://example.com/${path}`
  }
}

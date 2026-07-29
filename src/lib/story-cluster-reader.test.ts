import { describe, expect, it, vi } from "vitest"

import { type ReaderArticle } from "./articles"
import {
  evaluateStoryClustersForArticleUserWithDependencies,
  listStoryClustersForArticleUserWithClient,
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
  it("returns only current clusters whose members remain visible to the user", async () => {
    const store = {
      storyClusterVersion: {
        findMany: vi.fn().mockResolvedValue([
          {
            cluster: { currentVersionNumber: 1, id: "cluster-current" },
            evidence: [
              {
                leftMember: { articleId: "article-1" },
                rightMember: { articleId: "article-2" },
                signal: "CANONICAL_URL"
              }
            ],
            members: [{ articleId: "article-1" }, { articleId: "article-2" }],
            version: 1
          },
          {
            cluster: { currentVersionNumber: 2, id: "cluster-stale" },
            evidence: [
              {
                leftMember: { articleId: "article-1" },
                rightMember: { articleId: "article-3" },
                signal: "CANONICAL_URL"
              }
            ],
            members: [{ articleId: "article-1" }, { articleId: "article-3" }],
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
        id: "cluster-current",
        members: [
          {
            articleId: "article-1",
            feedTitle: "Example Feed",
            publishedAt: "2026-07-28T12:00:00.000Z",
            title: "Current article",
            url: "https://example.com/current"
          },
          {
            articleId: "article-2",
            feedTitle: "Example Feed",
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
              cluster: { currentVersionNumber: 1, id: "cluster-hidden-member" },
              evidence: [
                {
                  leftMember: { articleId: "article-1" },
                  rightMember: { articleId: "article-2" },
                  signal: "CANONICAL_URL"
                }
              ],
              members: [{ articleId: "article-1" }, { articleId: "article-2" }],
              version: 1
            }
          ])
        }
      },
      userId: "user-1"
    })

    expect(clusters).toEqual([])
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

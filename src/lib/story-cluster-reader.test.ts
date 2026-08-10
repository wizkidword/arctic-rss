import { describe, expect, it, vi } from "vitest"

import { type StoryClusterArticleProjection } from "./articles"
import type { StorySignalArticle } from "./story-signals"
import {
  evaluateStoryClustersForArticleUserWithDependencies,
  listStoryClustersForArticleUserWithClient,
  listStoryClustersForArticlesUserWithClient,
  STORY_CLUSTER_READER_WINDOW_SIZE
} from "./story-cluster-reader"

describe("story cluster reader evaluation", () => {
  it("persists only the selected article's candidate from a capped reader window", async () => {
    const selectedArticle = createStorySignalArticle(
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
        getStorySignalArticle: vi.fn().mockResolvedValue(selectedArticle),
        listStorySignalArticles: vi
          .fn()
          .mockResolvedValue([
            createStorySignalArticle("article-2", "Shared story", "story"),
            createStorySignalArticle("article-3", "Unrelated", "unrelated")
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
    const selectedArticle = createStorySignalArticle(
      "article-1",
      "Shared story",
      "story"
    )
    const persistCandidate = vi.fn()
    const readerArticles = Array.from(
      { length: STORY_CLUSTER_READER_WINDOW_SIZE },
      (_, index) =>
        createStorySignalArticle(
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
        getStorySignalArticle: vi.fn().mockResolvedValue(selectedArticle),
        listStorySignalArticles: vi.fn().mockResolvedValue(readerArticles),
        persistCandidate
      },
      userId: "user-1"
    })

    expect(result).toEqual({ created: false, dismissed: false, matched: false })
    expect(persistCandidate).not.toHaveBeenCalled()
  })

  it("evaluates only signal fields and never touches an article body or sanitizer input", async () => {
    const selectedArticle = createStorySignalArticle(
      "article-1",
      "Shared story",
      "story"
    )
    Object.defineProperty(selectedArticle, "contentHtml", {
      get() {
        throw new Error("Story evaluation must not read article HTML.")
      },
    })

    await expect(
      evaluateStoryClustersForArticleUserWithDependencies({
        articleId: selectedArticle.id,
        dependencies: {
          getStorySignalArticle: vi.fn().mockResolvedValue(selectedArticle),
          listStorySignalArticles: vi
            .fn()
            .mockResolvedValue([
              createStorySignalArticle("article-2", "Shared story", "story"),
            ]),
          persistCandidate: vi.fn().mockResolvedValue({
            created: false,
            dismissed: false,
          }),
        },
        userId: "user-1",
      })
    ).resolves.toEqual({ created: false, dismissed: false, matched: true })
  })
})

describe("story cluster reader presentation", () => {
  it("qualifies selected articles through current-version membership in PostgreSQL", async () => {
    const queryRaw = vi.fn().mockResolvedValue([{ id: "cluster-current" }])
    const findMany = vi.fn().mockResolvedValue([])

    await expect(
      listStoryClustersForArticleUserWithClient({
        articleId: "article-1",
        loadArticles: vi.fn(),
        store: { $queryRaw: queryRaw, storyCluster: { findMany } },
        userId: "user-1",
      })
    ).resolves.toEqual([])

    expect(queryRaw).toHaveBeenCalledTimes(1)
    expect(queryRaw.mock.calls[0]?.[0].strings.join("?")).toContain(
      '"currentVersion"."version" = "cluster"."currentVersionNumber"'
    )
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ["cluster-current"] },
          status: "ACTIVE",
          userId: "user-1",
        }),
      })
    )
  })

  it("loads active groups that overlap a reader page with one bounded query", async () => {
    const findMany = vi.fn().mockResolvedValue([])

    await expect(
      listStoryClustersForArticlesUserWithClient({
        articleIds: ["article-1", "article-2", "article-1"],
        loadArticles: vi.fn(),
        store: {
          $queryRaw: currentClusterIds("cluster-1"),
          storyCluster: { findMany },
        },
        userId: "user-1"
      })
    ).resolves.toEqual([])

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 24,
        where: expect.objectContaining({
          status: "ACTIVE",
          userId: "user-1",
          id: { in: ["cluster-1"] }
        }),
        select: expect.objectContaining({
          versions: expect.objectContaining({
            orderBy: { version: "desc" },
            take: 1,
          }),
        }),
      })
    )
  })

  it("returns only current clusters whose members remain visible to the user", async () => {
    const store = {
      $queryRaw: currentClusterIds("cluster-current"),
      storyCluster: {
        findMany: vi.fn().mockResolvedValue([
          currentClusterFromVersion({
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
          }),
          currentClusterFromVersion({
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
          })
        ])
      }
    }
    const loadArticles = vi
      .fn()
      .mockResolvedValue([
        createStoryClusterArticle("article-1", "Current article", "current"),
        createStoryClusterArticle("article-2", "Related article", "related")
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
    expect(store.storyCluster.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 12,
        where: expect.objectContaining({
          status: "ACTIVE",
          userId: "user-1",
          id: { in: ["cluster-current"] },
        }),
        select: expect.objectContaining({
          versions: expect.objectContaining({ take: 1 })
        })
      })
    )
  })

  it("keeps an older current cluster when another cluster has more than twelve historical versions", async () => {
    const heavilyVersionedCluster = currentClusterFromVersion({
      analyses: [],
      cluster: { currentVersionNumber: 14, id: "cluster-heavily-versioned" },
      evidence: [
        {
          leftMember: { articleId: "article-1" },
          rightMember: { articleId: "article-2" },
          signal: "CANONICAL_URL" as const,
        },
      ],
      members: [
        { articleId: "article-1", id: "member-heavy-1" },
        { articleId: "article-2", id: "member-heavy-2" },
      ],
      version: 14,
    })
    heavilyVersionedCluster.versions.push(
      ...Array.from({ length: 13 }, (_, index) => ({
        ...heavilyVersionedCluster.versions[0]!,
        version: 13 - index,
      }))
    )
    const olderCurrentCluster = currentClusterFromVersion({
      analyses: [],
      cluster: { currentVersionNumber: 1, id: "cluster-older-current" },
      evidence: [
        {
          leftMember: { articleId: "article-1" },
          rightMember: { articleId: "article-3" },
          signal: "CANONICAL_URL" as const,
        },
      ],
      members: [
        { articleId: "article-1", id: "member-older-1" },
        { articleId: "article-3", id: "member-older-3" },
      ],
      version: 1,
    })
    const findMany = vi
      .fn()
      .mockResolvedValue([heavilyVersionedCluster, olderCurrentCluster])

    const clusters = await listStoryClustersForArticlesUserWithClient({
      articleIds: ["article-1"],
      loadArticles: vi.fn().mockResolvedValue([
        createStoryClusterArticle("article-1", "Selected article", "selected"),
        createStoryClusterArticle("article-2", "Heavily versioned", "heavy"),
        createStoryClusterArticle("article-3", "Older current", "older"),
      ]),
      maxResults: 2,
      store: {
        $queryRaw: currentClusterIds(
          "cluster-heavily-versioned",
          "cluster-older-current"
        ),
        storyCluster: { findMany },
      },
      userId: "user-1",
    })

    expect(clusters.map((cluster) => cluster.id)).toEqual([
      "cluster-heavily-versioned",
      "cluster-older-current",
    ])
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          versions: expect.objectContaining({ take: 1 }),
        }),
      })
    )
  })

  it("suppresses a cluster if a member is paused, unsubscribed, or archived", async () => {
    const clusters = await listStoryClustersForArticleUserWithClient({
      articleId: "article-1",
      loadArticles: vi
        .fn()
        .mockResolvedValue([
          createStoryClusterArticle("article-1", "Current article", "current")
        ]),
      store: {
        $queryRaw: currentClusterIds("cluster-hidden-member"),
        storyCluster: {
          findMany: vi.fn().mockResolvedValue([
            currentClusterFromVersion({
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
            })
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
          createStoryClusterArticle("article-1", "Current article", "current"),
          createStoryClusterArticle("article-2", "Related article", "related")
        ]),
      store: {
        $queryRaw: currentClusterIds("cluster-current"),
        storyCluster: {
          findMany: vi.fn().mockResolvedValue([
            currentClusterFromVersion({
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
                  sourceCount: 3
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
            })
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
      sourceCount: 3
    })
  })
})

function createStorySignalArticle(
  id: string,
  title: string,
  path: string
): StorySignalArticle {
  return {
    canonicalUrl: null,
    id,
    publishedAt: new Date("2026-07-28T12:00:00.000Z"),
    title,
    url: `https://example.com/${path}`
  }
}

function currentClusterIds(...ids: string[]) {
  return vi.fn().mockResolvedValue(ids.map((id) => ({ id })))
}

function currentClusterFromVersion<
  T extends {
    cluster: { currentVersionNumber: number; id: string }
  },
>(version: T) {
  const { cluster, ...currentVersion } = version

  return {
    ...cluster,
    versions: [currentVersion],
  }
}

function createStoryClusterArticle(
  id: string,
  title: string,
  path: string
): StoryClusterArticleProjection {
  return {
    feedTitle: "Example Feed",
    id,
    publishedAt: new Date("2026-07-28T12:00:00.000Z"),
    title,
    url: `https://example.com/${path}`,
  }
}

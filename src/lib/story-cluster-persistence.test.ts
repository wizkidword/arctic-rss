import { describe, expect, it, vi } from "vitest"

import {
  persistStoryClusterCandidateForUserWithClient,
  StoryClusterPersistenceError,
  type StoryClusterPersistenceStore,
} from "./story-cluster-persistence"
import type { StoryClusterCandidate } from "./story-cluster-policy"

const candidate: StoryClusterCandidate = {
  algorithmVersion: "canonical-url-or-normalized-title-72h-v1",
  deduplicationKey: "story-cluster:canonical-url-or-normalized-title-72h-v1:abc",
  evidence: [
    {
      leftArticleId: "article-a",
      rightArticleId: "article-b",
      signal: "CANONICAL_URL" as const,
    },
  ],
  memberArticleIds: ["article-a", "article-b"],
}

function createStore({
  articles = [
    {
      feed: { title: "First Source" },
      id: "article-a",
      publishedAt: new Date("2026-07-28T10:00:00.000Z"),
      title: "First headline",
      url: "https://first.example/story",
    },
    {
      feed: { title: "Second Source" },
      id: "article-b",
      publishedAt: new Date("2026-07-28T11:00:00.000Z"),
      title: "Second headline",
      url: "https://second.example/story",
    },
  ],
  dismissed = false,
  existing = false,
}: {
  articles?: Array<{
    feed: { title: string }
    id: string
    publishedAt: Date | null
    title: string
    url: string
  }>
  dismissed?: boolean
  existing?: boolean
} = {}) {
  const mocks = {
    articleFindMany: vi.fn().mockResolvedValue(articles),
    clusterUpdate: vi.fn().mockResolvedValue({}),
    clusterUpsert: vi.fn().mockResolvedValue({
      currentVersionNumber: existing ? 1 : 0,
      id: "cluster-1",
      status: dismissed ? "DISMISSED" : "ACTIVE",
    }),
    evidenceCreateMany: vi.fn().mockResolvedValue({ count: 1 }),
    memberCreate: vi.fn(({ data }) =>
      Promise.resolve({ articleId: data.articleId, id: `member-${data.articleId}` })
    ),
    versionCreate: vi.fn().mockResolvedValue({ id: "version-1", version: 1 }),
    versionFindFirst: vi.fn().mockResolvedValue(
      existing ? { id: "version-existing", version: 1 } : null
    ),
  }
  const transaction = {
    article: {
      findMany: mocks.articleFindMany,
    },
    storyCluster: {
      update: mocks.clusterUpdate,
      upsert: mocks.clusterUpsert,
    },
    storyClusterEvidence: {
      createMany: mocks.evidenceCreateMany,
    },
    storyClusterMember: {
      create: mocks.memberCreate,
    },
    storyClusterVersion: {
      create: mocks.versionCreate,
      findFirst: mocks.versionFindFirst,
    },
  }
  const store = {
    $transaction: vi.fn(
      async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction)
    ),
  }

  return {
    mocks,
    store: store as unknown as StoryClusterPersistenceStore,
  }
}

describe("persistStoryClusterCandidateForUserWithClient", () => {
  it("rechecks visibility and persists a fully explained first cluster version", async () => {
    const { mocks, store } = createStore()

    await expect(
      persistStoryClusterCandidateForUserWithClient({
        candidate,
        store,
        userId: "user-1",
      })
    ).resolves.toEqual({
      clusterId: "cluster-1",
      created: true,
      dismissed: false,
      versionId: "version-1",
      versionNumber: 1,
    })

    expect(mocks.articleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: expect.arrayContaining([
            {
              feed: {
                subscriptions: {
                  some: {
                    isPaused: false,
                    userId: "user-1",
                  },
                },
              },
            },
            {
              states: {
                none: {
                  archivedAt: { not: null },
                  userId: "user-1",
                },
              },
            },
          ]),
        },
      })
    )
    expect(mocks.clusterUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          currentVersionNumber: 0,
          deduplicationKey: candidate.deduplicationKey,
          userId: "user-1",
        }),
        where: {
          userId_deduplicationKey: {
            deduplicationKey: candidate.deduplicationKey,
            userId: "user-1",
          },
        },
      })
    )
    expect(mocks.versionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          algorithmVersion: candidate.algorithmVersion,
          action: "CREATED",
        }),
      })
    )
    expect(mocks.evidenceCreateMany).toHaveBeenCalledWith({
      data: [
        {
          clusterVersionId: "version-1",
          leftMemberId: "member-article-a",
          rightMemberId: "member-article-b",
          signal: "CANONICAL_URL",
        },
      ],
    })
  })

  it("returns the existing version for an idempotent candidate rerun", async () => {
    const { mocks, store } = createStore({ existing: true })

    await expect(
      persistStoryClusterCandidateForUserWithClient({
        candidate,
        store,
        userId: "user-1",
      })
    ).resolves.toEqual({
      clusterId: "cluster-1",
      created: false,
      dismissed: false,
      versionId: "version-existing",
      versionNumber: 1,
    })

    expect(mocks.versionCreate).not.toHaveBeenCalled()
    expect(mocks.memberCreate).not.toHaveBeenCalled()
    expect(mocks.evidenceCreateMany).not.toHaveBeenCalled()
  })

  it("preserves a dismissed group when a candidate is checked again", async () => {
    const { mocks, store } = createStore({ dismissed: true, existing: true })

    await expect(
      persistStoryClusterCandidateForUserWithClient({
        candidate,
        store,
        userId: "user-1",
      })
    ).resolves.toEqual({
      clusterId: "cluster-1",
      created: false,
      dismissed: true,
      versionId: "version-existing",
      versionNumber: 1,
    })

    expect(mocks.versionCreate).not.toHaveBeenCalled()
    expect(mocks.clusterUpdate).not.toHaveBeenCalled()
  })

  it("rejects a candidate if any article is not visible to the user", async () => {
    const { mocks, store } = createStore({
      articles: [
        {
          feed: { title: "First Source" },
          id: "article-a",
          publishedAt: null,
          title: "First headline",
          url: "https://first.example/story",
        },
      ],
    })

    await expect(
      persistStoryClusterCandidateForUserWithClient({
        candidate,
        store,
        userId: "user-1",
      })
    ).rejects.toEqual(
      new StoryClusterPersistenceError(
        "Every story-cluster article must still be visible to this user."
      )
    )

    expect(mocks.clusterUpsert).not.toHaveBeenCalled()
  })

  it("rejects an unexplained candidate before creating a cluster", async () => {
    const { mocks, store } = createStore()

    await expect(
      persistStoryClusterCandidateForUserWithClient({
        candidate: { ...candidate, evidence: [] },
        store,
        userId: "user-1",
      })
    ).rejects.toThrow("requires at least one visible grouping reason")

    expect(mocks.clusterUpsert).not.toHaveBeenCalled()
  })
})

import { describe, expect, it, vi } from "vitest"

import {
  dismissStoryClusterForUserWithClient,
  StoryClusterControlError,
  type StoryClusterControlStore,
} from "./story-cluster-controls"

function createStore({
  cluster = {
    currentVersionNumber: 1,
    id: "cluster-1",
    status: "ACTIVE" as const,
    versions: [
      {
        algorithmVersion: "canonical-url-or-normalized-title-72h-v1",
        evidence: [
          {
            leftMember: { articleId: "article-a" },
            rightMember: { articleId: "article-b" },
            signal: "CANONICAL_URL" as const,
          },
        ],
        members: [
          {
            articleId: "article-a",
            articleTitle: "First headline",
            articleUrl: "https://first.example/story",
            feedTitle: "First Source",
            publishedAt: new Date("2026-07-28T10:00:00.000Z"),
          },
          {
            articleId: "article-b",
            articleTitle: "Second headline",
            articleUrl: "https://second.example/story",
            feedTitle: "Second Source",
            publishedAt: new Date("2026-07-28T11:00:00.000Z"),
          },
        ],
        version: 1,
      },
    ],
  },
}: {
  cluster?: unknown
} = {}) {
  const mocks = {
    clusterFindUnique: vi.fn().mockResolvedValue(cluster),
    clusterUpdate: vi.fn().mockResolvedValue({}),
    evidenceCreateMany: vi.fn().mockResolvedValue({ count: 1 }),
    memberCreate: vi.fn(({ data }) =>
      Promise.resolve({ articleId: data.articleId, id: `member-${data.articleId}` })
    ),
    versionCreate: vi.fn().mockResolvedValue({ id: "version-2", version: 2 }),
  }
  const transaction = {
    storyCluster: {
      findUnique: mocks.clusterFindUnique,
      update: mocks.clusterUpdate,
    },
    storyClusterEvidence: {
      createMany: mocks.evidenceCreateMany,
    },
    storyClusterMember: {
      create: mocks.memberCreate,
    },
    storyClusterVersion: {
      create: mocks.versionCreate,
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
    store: store as unknown as StoryClusterControlStore,
  }
}

describe("dismissStoryClusterForUserWithClient", () => {
  it("adds an immutable dismissed snapshot for the signed-in user's active group", async () => {
    const { mocks, store } = createStore()

    await expect(
      dismissStoryClusterForUserWithClient({
        clusterId: "cluster-1",
        store,
        userId: "user-1",
      })
    ).resolves.toEqual({
      clusterId: "cluster-1",
      dismissed: true,
      versionNumber: 2,
    })

    expect(mocks.clusterFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_id: {
            id: "cluster-1",
            userId: "user-1",
          },
        },
      })
    )
    expect(mocks.versionCreate).toHaveBeenCalledWith({
      data: {
        action: "DISMISSED",
        algorithmVersion: "canonical-url-or-normalized-title-72h-v1",
        clusterId: "cluster-1",
        deduplicationKey: null,
        version: 2,
      },
      select: {
        id: true,
        version: true,
      },
    })
    expect(mocks.evidenceCreateMany).toHaveBeenCalledWith({
      data: [
        {
          clusterVersionId: "version-2",
          leftMemberId: "member-article-a",
          rightMemberId: "member-article-b",
          signal: "CANONICAL_URL",
        },
      ],
    })
    expect(mocks.clusterUpdate).toHaveBeenCalledWith({
      data: {
        currentVersionNumber: 2,
        status: "DISMISSED",
      },
      where: {
        id: "cluster-1",
      },
    })
  })

  it("does not add another version for a group already dismissed", async () => {
    const { mocks, store } = createStore({
      cluster: {
        currentVersionNumber: 2,
        id: "cluster-1",
        status: "DISMISSED",
        versions: [],
      },
    })

    await expect(
      dismissStoryClusterForUserWithClient({
        clusterId: "cluster-1",
        store,
        userId: "user-1",
      })
    ).resolves.toEqual({
      clusterId: "cluster-1",
      dismissed: false,
      versionNumber: 2,
    })

    expect(mocks.versionCreate).not.toHaveBeenCalled()
    expect(mocks.memberCreate).not.toHaveBeenCalled()
    expect(mocks.evidenceCreateMany).not.toHaveBeenCalled()
    expect(mocks.clusterUpdate).not.toHaveBeenCalled()
  })

  it("rejects a missing or cross-user group without creating history", async () => {
    const { mocks, store } = createStore({ cluster: null })

    await expect(
      dismissStoryClusterForUserWithClient({
        clusterId: "cluster-1",
        store,
        userId: "user-1",
      })
    ).rejects.toEqual(
      new StoryClusterControlError("That related-coverage group is not available.")
    )

    expect(mocks.versionCreate).not.toHaveBeenCalled()
  })
})

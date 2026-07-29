import { describe, expect, it, vi } from "vitest"

import {
  dismissStoryClusterForUserWithClient,
  mergeStoryClustersForUserWithClient,
  splitStoryClusterMemberForUserWithClient,
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
  versionFindFirst = null,
}: {
  cluster?: unknown
  versionFindFirst?: { version: number } | null
} = {}) {
  const mocks = {
    clusterFindUnique: vi.fn().mockResolvedValue(cluster),
    clusterUpdate: vi.fn().mockResolvedValue({}),
    evidenceCreateMany: vi.fn().mockResolvedValue({ count: 1 }),
    memberCreate: vi.fn(({ data }) =>
      Promise.resolve({ articleId: data.articleId, id: `member-${data.articleId}` })
    ),
    versionCreate: vi.fn().mockResolvedValue({ id: "version-2", version: 2 }),
    versionFindFirst: vi.fn().mockResolvedValue(versionFindFirst),
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
    store: store as unknown as StoryClusterControlStore,
  }
}

const activeThreeMemberCluster = {
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
        {
          leftMember: { articleId: "article-b" },
          rightMember: { articleId: "article-c" },
          signal: "NORMALIZED_TITLE" as const,
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
        {
          articleId: "article-c",
          articleTitle: "Third headline",
          articleUrl: "https://third.example/story",
          feedTitle: "Third Source",
          publishedAt: new Date("2026-07-28T12:00:00.000Z"),
        },
      ],
      version: 1,
    },
  ],
}

const activeMergeableClusters = {
  primary: {
    currentVersionNumber: 1,
    id: "cluster-a",
    status: "ACTIVE" as const,
    versions: [
      {
        algorithmVersion: "canonical-url-or-normalized-title-72h-v1",
        evidence: [
          {
            leftMember: { articleId: "article-a" },
            rightMember: { articleId: "article-shared" },
            signal: "CANONICAL_URL" as const,
          },
        ],
        members: [
          {
            articleId: "article-a",
            articleTitle: "First outlet's story",
            articleUrl: "https://first.example/story",
            feedTitle: "First Source",
            publishedAt: new Date("2026-07-28T10:00:00.000Z"),
          },
          {
            articleId: "article-shared",
            articleTitle: "Shared outlet's story",
            articleUrl: "https://shared.example/story",
            feedTitle: "Shared Source",
            publishedAt: new Date("2026-07-28T10:30:00.000Z"),
          },
        ],
        version: 1,
      },
    ],
  },
  secondary: {
    currentVersionNumber: 1,
    id: "cluster-b",
    status: "ACTIVE" as const,
    versions: [
      {
        algorithmVersion: "canonical-url-or-normalized-title-72h-v1",
        evidence: [
          {
            leftMember: { articleId: "article-b" },
            rightMember: { articleId: "article-shared" },
            signal: "NORMALIZED_TITLE" as const,
          },
        ],
        members: [
          {
            articleId: "article-b",
            articleTitle: "Second outlet's story",
            articleUrl: "https://second.example/story",
            feedTitle: "Second Source",
            publishedAt: new Date("2026-07-28T11:00:00.000Z"),
          },
          {
            articleId: "article-shared",
            articleTitle: "Shared outlet's story",
            articleUrl: "https://shared.example/story",
            feedTitle: "Shared Source",
            publishedAt: new Date("2026-07-28T10:30:00.000Z"),
          },
        ],
        version: 1,
      },
    ],
  },
}

function mergeableClusterById(clusterId: string) {
  if (clusterId === activeMergeableClusters.primary.id) {
    return activeMergeableClusters.primary
  }

  if (clusterId === activeMergeableClusters.secondary.id) {
    return activeMergeableClusters.secondary
  }

  return null
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

describe("splitStoryClusterMemberForUserWithClient", () => {
  it("separates one source by appending an immutable, explained split snapshot", async () => {
    const { mocks, store } = createStore({ cluster: activeThreeMemberCluster })

    await expect(
      splitStoryClusterMemberForUserWithClient({
        clusterId: "cluster-1",
        memberArticleId: "article-c",
        store,
        userId: "user-1",
      })
    ).resolves.toEqual({
      clusterId: "cluster-1",
      split: true,
      versionNumber: 2,
    })

    expect(mocks.versionFindFirst).toHaveBeenCalledWith({
      select: {
        version: true,
      },
      where: {
        clusterId: "cluster-1",
        deduplicationKey: "story-cluster-split:article-c",
      },
    })
    expect(mocks.versionCreate).toHaveBeenCalledWith({
      data: {
        action: "SPLIT",
        algorithmVersion: "canonical-url-or-normalized-title-72h-v1",
        clusterId: "cluster-1",
        deduplicationKey: "story-cluster-split:article-c",
        version: 2,
      },
      select: {
        id: true,
        version: true,
      },
    })
    expect(mocks.memberCreate).toHaveBeenCalledTimes(2)
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
      },
      where: {
        id: "cluster-1",
      },
    })
  })

  it("does not create a duplicate history version when a source was already separated", async () => {
    const { mocks, store } = createStore({
      cluster: activeThreeMemberCluster,
      versionFindFirst: { version: 2 },
    })

    await expect(
      splitStoryClusterMemberForUserWithClient({
        clusterId: "cluster-1",
        memberArticleId: "article-c",
        store,
        userId: "user-1",
      })
    ).resolves.toEqual({
      clusterId: "cluster-1",
      split: false,
      versionNumber: 2,
    })

    expect(mocks.versionCreate).not.toHaveBeenCalled()
    expect(mocks.clusterUpdate).not.toHaveBeenCalled()
  })

  it("rejects a split that would leave fewer than two sources", async () => {
    const { mocks, store } = createStore()

    await expect(
      splitStoryClusterMemberForUserWithClient({
        clusterId: "cluster-1",
        memberArticleId: "article-a",
        store,
        userId: "user-1",
      })
    ).rejects.toEqual(
      new StoryClusterControlError(
        "A related-coverage group needs at least two sources after a split."
      )
    )

    expect(mocks.versionCreate).not.toHaveBeenCalled()
  })

  it("rejects a split when the remaining sources would no longer have a named connection", async () => {
    const { mocks, store } = createStore({ cluster: activeThreeMemberCluster })

    await expect(
      splitStoryClusterMemberForUserWithClient({
        clusterId: "cluster-1",
        memberArticleId: "article-b",
        store,
        userId: "user-1",
      })
    ).rejects.toEqual(
      new StoryClusterControlError(
        "The remaining sources do not form a fully explained related-coverage group."
      )
    )

    expect(mocks.versionCreate).not.toHaveBeenCalled()
  })
})

describe("mergeStoryClustersForUserWithClient", () => {
  it("adds explained immutable merge snapshots and hides only the absorbed group", async () => {
    const { mocks, store } = createStore()
    mocks.clusterFindUnique.mockImplementation(({ where }) =>
      Promise.resolve(mergeableClusterById(where.userId_id.id))
    )
    mocks.versionCreate
      .mockResolvedValueOnce({ id: "version-primary-2", version: 2 })
      .mockResolvedValueOnce({ id: "version-secondary-2", version: 2 })

    await expect(
      mergeStoryClustersForUserWithClient({
        firstClusterId: "cluster-b",
        secondClusterId: "cluster-a",
        store,
        userId: "user-1",
      })
    ).resolves.toEqual({
      clusterId: "cluster-a",
      merged: true,
      versionNumber: 2,
    })

    expect(mocks.versionFindFirst).toHaveBeenCalledWith({
      select: {
        version: true,
      },
      where: {
        clusterId: "cluster-a",
        deduplicationKey: "story-cluster-merge:cluster-a:cluster-b",
      },
    })
    expect(mocks.versionCreate).toHaveBeenNthCalledWith(1, {
      data: {
        action: "MERGED",
        algorithmVersion: "canonical-url-or-normalized-title-72h-v1",
        clusterId: "cluster-a",
        deduplicationKey: "story-cluster-merge:cluster-a:cluster-b",
        version: 2,
      },
      select: {
        id: true,
        version: true,
      },
    })
    expect(mocks.versionCreate).toHaveBeenNthCalledWith(2, {
      data: {
        action: "MERGED",
        algorithmVersion: "canonical-url-or-normalized-title-72h-v1",
        clusterId: "cluster-b",
        deduplicationKey: "story-cluster-merged-into:cluster-a",
        version: 2,
      },
      select: {
        id: true,
        version: true,
      },
    })
    expect(mocks.memberCreate).toHaveBeenCalledTimes(5)
    expect(mocks.evidenceCreateMany).toHaveBeenNthCalledWith(1, {
      data: [
        {
          clusterVersionId: "version-primary-2",
          leftMemberId: "member-article-a",
          rightMemberId: "member-article-shared",
          signal: "CANONICAL_URL",
        },
        {
          clusterVersionId: "version-primary-2",
          leftMemberId: "member-article-b",
          rightMemberId: "member-article-shared",
          signal: "NORMALIZED_TITLE",
        },
      ],
    })
    expect(mocks.clusterUpdate).toHaveBeenNthCalledWith(1, {
      data: {
        currentVersionNumber: 2,
      },
      where: {
        id: "cluster-a",
      },
    })
    expect(mocks.clusterUpdate).toHaveBeenNthCalledWith(2, {
      data: {
        currentVersionNumber: 2,
        status: "MERGED",
      },
      where: {
        id: "cluster-b",
      },
    })
  })

  it("is idempotent when the deterministic primary group already recorded the merge", async () => {
    const { mocks, store } = createStore({ versionFindFirst: { version: 2 } })
    mocks.clusterFindUnique.mockImplementation(({ where }) =>
      Promise.resolve(mergeableClusterById(where.userId_id.id))
    )

    await expect(
      mergeStoryClustersForUserWithClient({
        firstClusterId: "cluster-a",
        secondClusterId: "cluster-b",
        store,
        userId: "user-1",
      })
    ).resolves.toEqual({
      clusterId: "cluster-a",
      merged: false,
      versionNumber: 2,
    })

    expect(mocks.versionCreate).not.toHaveBeenCalled()
    expect(mocks.clusterUpdate).not.toHaveBeenCalled()
  })

  it("rejects groups without a shared source instead of inferring an opaque connection", async () => {
    const { mocks, store } = createStore()
    const unrelatedSecondary = {
      ...activeMergeableClusters.secondary,
      versions: [
        {
          ...activeMergeableClusters.secondary.versions[0],
          evidence: [
            {
              leftMember: { articleId: "article-b" },
              rightMember: { articleId: "article-c" },
              signal: "NORMALIZED_TITLE" as const,
            },
          ],
          members: [
            activeMergeableClusters.secondary.versions[0].members[0],
            {
              articleId: "article-c",
              articleTitle: "Third outlet's story",
              articleUrl: "https://third.example/story",
              feedTitle: "Third Source",
              publishedAt: new Date("2026-07-28T11:30:00.000Z"),
            },
          ],
        },
      ],
    }
    mocks.clusterFindUnique.mockImplementation(({ where }) =>
      Promise.resolve(
        where.userId_id.id === "cluster-a"
          ? activeMergeableClusters.primary
          : where.userId_id.id === "cluster-b"
            ? unrelatedSecondary
            : null
      )
    )

    await expect(
      mergeStoryClustersForUserWithClient({
        firstClusterId: "cluster-a",
        secondClusterId: "cluster-b",
        store,
        userId: "user-1",
      })
    ).rejects.toEqual(
      new StoryClusterControlError(
        "These related-coverage groups do not share a visible source to explain a merge."
      )
    )

    expect(mocks.versionCreate).not.toHaveBeenCalled()
  })

  it("does not expose or alter a group that is unavailable to the signed-in reader", async () => {
    const { mocks, store } = createStore({ cluster: null })

    await expect(
      mergeStoryClustersForUserWithClient({
        firstClusterId: "cluster-a",
        secondClusterId: "cluster-b",
        store,
        userId: "user-1",
      })
    ).rejects.toEqual(
      new StoryClusterControlError(
        "One of those related-coverage groups is not available."
      )
    )

    expect(mocks.versionCreate).not.toHaveBeenCalled()
  })
})

import { getPrisma } from "./db"
import {
  createStoryClusterVersionSnapshot,
  type StoryClusterEvidenceInput,
  type StoryClusterMemberSnapshotInput,
  type StoryClusterVersionAction,
} from "./story-cluster-history"

type CurrentStoryClusterVersion = {
  algorithmVersion: string | null
  evidence: Array<{
    leftMember: {
      articleId: string | null
    }
    rightMember: {
      articleId: string | null
    }
    signal: StoryClusterEvidenceInput["signal"]
  }>
  members: Array<{
    articleId: string | null
    articleTitle: string
    articleUrl: string
    feedTitle: string
    publishedAt: Date | null
  }>
  version: number
}

type UserStoryCluster = {
  currentVersionNumber: number
  id: string
  status: "ACTIVE" | "DISMISSED"
  versions: CurrentStoryClusterVersion[]
}

type StoryClusterControlTransaction = {
  storyCluster: {
    findUnique(args: Record<string, unknown>): Promise<UserStoryCluster | null>
    update(args: Record<string, unknown>): Promise<unknown>
  }
  storyClusterEvidence: {
    createMany(args: {
      data: Array<{
        clusterVersionId: string
        leftMemberId: string
        rightMemberId: string
        signal: StoryClusterEvidenceInput["signal"]
      }>
    }): Promise<unknown>
  }
  storyClusterMember: {
    create(args: {
      data: {
        articleId: string
        articleTitle: string
        articleUrl: string
        clusterVersionId: string
        feedTitle: string
        publishedAt: Date | null
      }
      select: {
        articleId: true
        id: true
      }
    }): Promise<{
      articleId: string | null
      id: string
    }>
  }
  storyClusterVersion: {
    create(args: {
      data: {
        action: ControlVersionAction
        algorithmVersion: string | null
        clusterId: string
        deduplicationKey: string | null
        version: number
      }
      select: {
        id: true
        version: true
      }
    }): Promise<{
      id: string
      version: number
    }>
    findFirst(args: {
      select: {
        version: true
      }
      where: {
        clusterId: string
        deduplicationKey: string
      }
    }): Promise<{
      version: number
    } | null>
  }
}

type ControlVersionAction = Extract<
  StoryClusterVersionAction,
  "DISMISSED" | "SPLIT"
>

export type StoryClusterControlStore = {
  $transaction<T>(
    callback: (transaction: StoryClusterControlTransaction) => Promise<T>
  ): Promise<T>
}

export type DismissStoryClusterResult = {
  clusterId: string
  dismissed: boolean
  versionNumber: number
}

export type SplitStoryClusterMemberResult = {
  clusterId: string
  split: boolean
  versionNumber: number
}

export class StoryClusterControlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "StoryClusterControlError"
  }
}

/**
 * Dismisses one user's current group by adding a fresh immutable snapshot.
 * The source articles are never altered; the reader simply stops displaying
 * this group while retaining a complete explanation of the decision.
 */
export async function dismissStoryClusterForUser({
  clusterId,
  userId,
}: {
  clusterId: string
  userId: string
}): Promise<DismissStoryClusterResult> {
  return dismissStoryClusterForUserWithClient({
    clusterId,
    store: getPrisma() as unknown as StoryClusterControlStore,
    userId,
  })
}

export async function dismissStoryClusterForUserWithClient({
  clusterId,
  store,
  userId,
}: {
  clusterId: string
  store: StoryClusterControlStore
  userId: string
}): Promise<DismissStoryClusterResult> {
  const normalizedClusterId = clusterId.trim()
  const normalizedUserId = userId.trim()

  if (!normalizedClusterId || !normalizedUserId) {
    throw new StoryClusterControlError("Choose an available related-coverage group first.")
  }

  return store.$transaction(async (transaction) => {
    const cluster = await transaction.storyCluster.findUnique({
      select: {
        currentVersionNumber: true,
        id: true,
        status: true,
        versions: {
          orderBy: {
            version: "desc",
          },
          select: {
            algorithmVersion: true,
            evidence: {
              select: {
                leftMember: {
                  select: {
                    articleId: true,
                  },
                },
                rightMember: {
                  select: {
                    articleId: true,
                  },
                },
                signal: true,
              },
            },
            members: {
              select: {
                articleId: true,
                articleTitle: true,
                articleUrl: true,
                feedTitle: true,
                publishedAt: true,
              },
            },
            version: true,
          },
          take: 1,
        },
      },
      where: {
        userId_id: {
          id: normalizedClusterId,
          userId: normalizedUserId,
        },
      },
    })

    if (!cluster) {
      throw new StoryClusterControlError("That related-coverage group is not available.")
    }

    if (cluster.status === "DISMISSED") {
      return {
        clusterId: cluster.id,
        dismissed: false,
        versionNumber: cluster.currentVersionNumber,
      }
    }

    const currentVersion = cluster.versions[0]

    if (!currentVersion || currentVersion.version !== cluster.currentVersionNumber) {
      throw new StoryClusterControlError(
        "This related-coverage group is missing its current history snapshot."
      )
    }

    const snapshot = snapshotInputFromCurrentVersion(currentVersion)
    const version = await appendClusterVersion({
      action: "DISMISSED",
      cluster,
      currentVersion,
      deduplicationKey: null,
      evidence: snapshot.evidence,
      members: snapshot.members,
      status: "DISMISSED",
      transaction,
    })

    return {
      clusterId: cluster.id,
      dismissed: true,
      versionNumber: version.version,
    }
  })
}

/**
 * Splits one source out of an active group. The separated source remains an
 * ordinary original article in the reader; this only updates the saved group
 * when the remaining sources still form a fully explained cluster.
 */
export async function splitStoryClusterMemberForUser({
  clusterId,
  memberArticleId,
  userId,
}: {
  clusterId: string
  memberArticleId: string
  userId: string
}): Promise<SplitStoryClusterMemberResult> {
  return splitStoryClusterMemberForUserWithClient({
    clusterId,
    memberArticleId,
    store: getPrisma() as unknown as StoryClusterControlStore,
    userId,
  })
}

export async function splitStoryClusterMemberForUserWithClient({
  clusterId,
  memberArticleId,
  store,
  userId,
}: {
  clusterId: string
  memberArticleId: string
  store: StoryClusterControlStore
  userId: string
}): Promise<SplitStoryClusterMemberResult> {
  const normalizedClusterId = clusterId.trim()
  const normalizedMemberArticleId = memberArticleId.trim()
  const normalizedUserId = userId.trim()

  if (!normalizedClusterId || !normalizedMemberArticleId || !normalizedUserId) {
    throw new StoryClusterControlError("Choose an available source and related-coverage group first.")
  }

  return store.$transaction(async (transaction) => {
    const cluster = await transaction.storyCluster.findUnique({
      select: {
        currentVersionNumber: true,
        id: true,
        status: true,
        versions: {
          orderBy: {
            version: "desc",
          },
          select: {
            algorithmVersion: true,
            evidence: {
              select: {
                leftMember: {
                  select: {
                    articleId: true,
                  },
                },
                rightMember: {
                  select: {
                    articleId: true,
                  },
                },
                signal: true,
              },
            },
            members: {
              select: {
                articleId: true,
                articleTitle: true,
                articleUrl: true,
                feedTitle: true,
                publishedAt: true,
              },
            },
            version: true,
          },
          take: 1,
        },
      },
      where: {
        userId_id: {
          id: normalizedClusterId,
          userId: normalizedUserId,
        },
      },
    })

    if (!cluster) {
      throw new StoryClusterControlError("That related-coverage group is not available.")
    }

    if (cluster.status === "DISMISSED") {
      throw new StoryClusterControlError("This related-coverage group is already dismissed.")
    }

    const deduplicationKey = splitDeduplicationKey(normalizedMemberArticleId)
    const existingSplit = await transaction.storyClusterVersion.findFirst({
      select: {
        version: true,
      },
      where: {
        clusterId: cluster.id,
        deduplicationKey,
      },
    })

    if (existingSplit) {
      return {
        clusterId: cluster.id,
        split: false,
        versionNumber: existingSplit.version,
      }
    }

    const currentVersion = cluster.versions[0]

    if (!currentVersion || currentVersion.version !== cluster.currentVersionNumber) {
      throw new StoryClusterControlError(
        "This related-coverage group is missing its current history snapshot."
      )
    }

    const snapshot = snapshotInputFromCurrentVersion(currentVersion)
    const members = snapshot.members.filter(
      (member) => member.articleId !== normalizedMemberArticleId
    )

    if (members.length === snapshot.members.length) {
      throw new StoryClusterControlError("That source is not part of this related-coverage group.")
    }

    if (members.length < 2) {
      throw new StoryClusterControlError(
        "A related-coverage group needs at least two sources after a split."
      )
    }

    const retainedArticleIds = new Set(members.map((member) => member.articleId))
    const evidence = snapshot.evidence.filter(
      (edge) =>
        retainedArticleIds.has(edge.leftArticleId) &&
        retainedArticleIds.has(edge.rightArticleId)
    )

    try {
      createStoryClusterVersionSnapshot({
        action: "SPLIT",
        deduplicationKey,
        evidence,
        members,
        previousVersionNumber: cluster.currentVersionNumber,
      })
    } catch (error) {
      if (error instanceof StoryClusterControlError) {
        throw error
      }

      throw new StoryClusterControlError(
        "The remaining sources do not form a fully explained related-coverage group."
      )
    }

    const version = await appendClusterVersion({
      action: "SPLIT",
      cluster,
      currentVersion,
      deduplicationKey,
      evidence,
      members,
      transaction,
    })

    return {
      clusterId: cluster.id,
      split: true,
      versionNumber: version.version,
    }
  })
}

function snapshotInputFromCurrentVersion(currentVersion: CurrentStoryClusterVersion) {
  return {
    evidence: currentVersion.evidence.map((evidence) => ({
      leftArticleId: requireArticleId(evidence.leftMember.articleId),
      rightArticleId: requireArticleId(evidence.rightMember.articleId),
      signal: evidence.signal,
    })),
    members: currentVersion.members.map((member) => ({
      articleId: requireArticleId(member.articleId),
      articleTitle: member.articleTitle,
      articleUrl: member.articleUrl,
      feedTitle: member.feedTitle,
      publishedAt: member.publishedAt,
    })),
  }
}

async function appendClusterVersion({
  action,
  cluster,
  currentVersion,
  deduplicationKey,
  evidence,
  members,
  status,
  transaction,
}: {
  action: ControlVersionAction
  cluster: UserStoryCluster
  currentVersion: CurrentStoryClusterVersion
  deduplicationKey: string | null
  evidence: StoryClusterEvidenceInput[]
  members: StoryClusterMemberSnapshotInput[]
  status?: "DISMISSED"
  transaction: StoryClusterControlTransaction
}) {
  const snapshot = createStoryClusterVersionSnapshot({
    action,
    deduplicationKey,
    evidence,
    members,
    previousVersionNumber: cluster.currentVersionNumber,
  })
  const version = await transaction.storyClusterVersion.create({
    data: {
      action,
      algorithmVersion: currentVersion.algorithmVersion,
      clusterId: cluster.id,
      deduplicationKey: snapshot.deduplicationKey,
      version: snapshot.version,
    },
    select: {
      id: true,
      version: true,
    },
  })
  const persistedMembers = await Promise.all(
    snapshot.members.map((member) =>
      transaction.storyClusterMember.create({
        data: {
          articleId: member.articleId,
          articleTitle: member.articleTitle,
          articleUrl: member.articleUrl,
          clusterVersionId: version.id,
          feedTitle: member.feedTitle,
          publishedAt: member.publishedAt,
        },
        select: {
          articleId: true,
          id: true,
        },
      })
    )
  )
  const memberIdsByArticleId = new Map(
    persistedMembers.flatMap((member) =>
      member.articleId ? [[member.articleId, member.id]] : []
    )
  )

  await transaction.storyClusterEvidence.createMany({
    data: snapshot.evidence.map((evidence) => ({
      clusterVersionId: version.id,
      leftMemberId: memberIdFor(evidence.leftArticleId, memberIdsByArticleId),
      rightMemberId: memberIdFor(evidence.rightArticleId, memberIdsByArticleId),
      signal: evidence.signal,
    })),
  })
  await transaction.storyCluster.update({
    data: {
      currentVersionNumber: version.version,
      ...(status ? { status } : {}),
    },
    where: {
      id: cluster.id,
    },
  })

  return version
}

function splitDeduplicationKey(memberArticleId: string) {
  return `story-cluster-split:${memberArticleId}`
}

function requireArticleId(articleId: string | null) {
  if (!articleId) {
    throw new StoryClusterControlError(
      "This related-coverage group is missing its current history snapshot."
    )
  }

  return articleId
}

function memberIdFor(articleId: string, memberIdsByArticleId: Map<string, string>) {
  const memberId = memberIdsByArticleId.get(articleId)

  if (!memberId) {
    throw new StoryClusterControlError(
      "This related-coverage group is missing its current history snapshot."
    )
  }

  return memberId
}

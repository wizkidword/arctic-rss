import { getPrisma } from "./db"
import {
  createStoryClusterVersionSnapshot,
  type StoryClusterEvidenceInput,
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
        action: "DISMISSED"
        algorithmVersion: string | null
        clusterId: string
        deduplicationKey: null
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
  }
}

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

    const snapshot = createStoryClusterVersionSnapshot({
      action: "DISMISSED",
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
      previousVersionNumber: cluster.currentVersionNumber,
    })
    const version = await transaction.storyClusterVersion.create({
      data: {
        action: "DISMISSED",
        algorithmVersion: currentVersion.algorithmVersion,
        clusterId: cluster.id,
        deduplicationKey: null,
        version: snapshot.version,
      },
      select: {
        id: true,
        version: true,
      },
    })
    const members = await Promise.all(
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
      members.flatMap((member) => (member.articleId ? [[member.articleId, member.id]] : []))
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
        status: "DISMISSED",
      },
      where: {
        id: cluster.id,
      },
    })

    return {
      clusterId: cluster.id,
      dismissed: true,
      versionNumber: version.version,
    }
  })
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

import { getPrisma } from "./db"
import {
  createStoryClusterVersionSnapshot,
  type StoryClusterEvidenceInput,
} from "./story-cluster-history"
import type { StoryClusterCandidate } from "./story-cluster-policy"

type AuthorizedClusterArticle = {
  feed: {
    title: string
  }
  id: string
  publishedAt: Date | null
  title: string
  url: string
}

type PersistedCluster = {
  currentVersionNumber: number
  id: string
}

type PersistedClusterVersion = {
  id: string
  version: number
}

type PersistedClusterMember = {
  articleId: string | null
  id: string
}

type StoryClusterPersistenceTransaction = {
  article: {
    findMany(args: Record<string, unknown>): Promise<AuthorizedClusterArticle[]>
  }
  storyCluster: {
    update(args: Record<string, unknown>): Promise<unknown>
    upsert(args: Record<string, unknown>): Promise<PersistedCluster>
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
    }): Promise<PersistedClusterMember>
  }
  storyClusterVersion: {
    create(args: {
      data: {
        action: "CREATED"
        algorithmVersion: string
        clusterId: string
        deduplicationKey: string
        version: number
      }
      select: {
        id: true
        version: true
      }
    }): Promise<PersistedClusterVersion>
    findFirst(args: {
      select: {
        id: true
        version: true
      }
      where: {
        clusterId: string
        deduplicationKey: string
      }
    }): Promise<PersistedClusterVersion | null>
  }
}

export type StoryClusterPersistenceStore = {
  $transaction<T>(
    callback: (transaction: StoryClusterPersistenceTransaction) => Promise<T>
  ): Promise<T>
}

export type PersistedStoryClusterCandidate = {
  clusterId: string
  created: boolean
  versionId: string
  versionNumber: number
}

export class StoryClusterPersistenceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "StoryClusterPersistenceError"
  }
}

/**
 * Persists one already-evaluated candidate after rechecking that every article
 * is still visible to the user. It neither discovers candidates nor changes
 * reader output, so callers retain control over bounded scope and scheduling.
 */
export async function persistStoryClusterCandidateForUser({
  candidate,
  userId,
}: {
  candidate: StoryClusterCandidate
  userId: string
}): Promise<PersistedStoryClusterCandidate> {
  return persistStoryClusterCandidateForUserWithClient({
    candidate,
    store: getPrisma() as unknown as StoryClusterPersistenceStore,
    userId,
  })
}

export async function persistStoryClusterCandidateForUserWithClient({
  candidate,
  store,
  userId,
}: {
  candidate: StoryClusterCandidate
  store: StoryClusterPersistenceStore
  userId: string
}): Promise<PersistedStoryClusterCandidate> {
  const normalizedUserId = userId.trim()
  const deduplicationKey = candidate.deduplicationKey.trim()
  const algorithmVersion = candidate.algorithmVersion.trim()

  if (!normalizedUserId) {
    throw new StoryClusterPersistenceError("A user is required to save a story cluster.")
  }

  if (!deduplicationKey) {
    throw new StoryClusterPersistenceError("A story cluster candidate requires a deduplication key.")
  }

  if (!algorithmVersion) {
    throw new StoryClusterPersistenceError("A story cluster candidate requires an algorithm version.")
  }

  return store.$transaction(async (transaction) => {
    const articles = await transaction.article.findMany({
      select: {
        feed: {
          select: {
            title: true,
          },
        },
        id: true,
        publishedAt: true,
        title: true,
        url: true,
      },
      where: {
        AND: [
          {
            feed: {
              subscriptions: {
                some: {
                  isPaused: false,
                  userId: normalizedUserId,
                },
              },
            },
          },
          {
            id: {
              in: candidate.memberArticleIds,
            },
          },
          {
            states: {
              none: {
                archivedAt: {
                  not: null,
                },
                userId: normalizedUserId,
              },
            },
          },
        ],
      },
    })
    const articlesById = new Map(articles.map((article) => [article.id, article]))

    if (articlesById.size !== candidate.memberArticleIds.length) {
      throw new StoryClusterPersistenceError(
        "Every story-cluster article must still be visible to this user."
      )
    }

    const snapshot = createStoryClusterVersionSnapshot({
      action: "CREATED",
      deduplicationKey,
      evidence: candidate.evidence,
      members: candidate.memberArticleIds.map((articleId) => {
        const article = articlesById.get(articleId)

        if (!article) {
          throw new StoryClusterPersistenceError(
            "Every story-cluster article must still be visible to this user."
          )
        }

        return {
          articleId,
          articleTitle: article.title,
          articleUrl: article.url,
          feedTitle: article.feed.title,
          publishedAt: article.publishedAt,
        }
      }),
      previousVersionNumber: 0,
    })

    const cluster = await transaction.storyCluster.upsert({
      create: {
        currentVersionNumber: 0,
        deduplicationKey,
        userId: normalizedUserId,
      },
      select: {
        currentVersionNumber: true,
        id: true,
      },
      update: {},
      where: {
        userId_deduplicationKey: {
          deduplicationKey,
          userId: normalizedUserId,
        },
      },
    })

    if (cluster.currentVersionNumber !== 0) {
      const existingVersion = await transaction.storyClusterVersion.findFirst({
        select: {
          id: true,
          version: true,
        },
        where: {
          clusterId: cluster.id,
          deduplicationKey,
        },
      })

      if (!existingVersion) {
        throw new StoryClusterPersistenceError(
          "The saved story cluster is missing its initial version."
        )
      }

      return {
        clusterId: cluster.id,
        created: false,
        versionId: existingVersion.id,
        versionNumber: existingVersion.version,
      }
    }

    const version = await transaction.storyClusterVersion.create({
      data: {
        action: "CREATED",
        algorithmVersion,
        clusterId: cluster.id,
        deduplicationKey,
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
      },
      where: {
        id: cluster.id,
      },
    })

    return {
      clusterId: cluster.id,
      created: true,
      versionId: version.id,
      versionNumber: version.version,
    }
  })
}

function memberIdFor(articleId: string, memberIdsByArticleId: Map<string, string>) {
  const memberId = memberIdsByArticleId.get(articleId)

  if (!memberId) {
    throw new StoryClusterPersistenceError(
      "A saved story-cluster reason referenced a missing member."
    )
  }

  return memberId
}

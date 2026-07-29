import {
  getReaderArticleForUser,
  listReaderArticles,
  listReaderArticlesByIdsForUser,
  type ReaderArticle
} from "./articles"
import {
  STORY_CLUSTER_SIGNALS,
  type StoryClusterSignal
} from "./story-cluster-history"
import {
  buildStoryClusterCandidates,
  type StoryClusterCandidate
} from "./story-cluster-policy"
import {
  persistStoryClusterCandidateForUser,
  StoryClusterPersistenceError
} from "./story-cluster-persistence"
import { getPrisma } from "./db"

export const STORY_CLUSTER_READER_WINDOW_SIZE = 50
const STORY_CLUSTER_VERSION_LOOKUP_LIMIT = 12
const MAX_VISIBLE_STORY_CLUSTERS_PER_ARTICLE = 3

export type StoryClusterPresentationMember = {
  articleId: string
  feedTitle: string
  memberId: string
  publishedAt: string | null
  title: string
  url: string
}

export type StoryClusterAnalysisPresentation = {
  claims: Array<{
    citations: string[]
    kind:
      | "LATEST_DEVELOPMENT"
      | "NEW_FACT"
      | "CORRECTION"
      | "REPEATED_CLAIM"
      | "DISAGREEMENT"
    statement: string
  }>
  model: string
  provider: string
  sourceCount: number
}

export type StoryClusterPresentation = {
  id: string
  members: StoryClusterPresentationMember[]
  reasons: StoryClusterSignal[]
  analysis: StoryClusterAnalysisPresentation | null
}

type StoryClusterVersionRecord = {
  analyses: Array<{
    claims: Array<{
      citations: Array<{
        memberId: string
        position: number
      }>
      kind: StoryClusterAnalysisPresentation["claims"][number]["kind"]
      position: number
      statement: string
    }>
    model: string
    provider: string
    sourceCount: number
  }>
  cluster: {
    currentVersionNumber: number
    id: string
  }
  evidence: Array<{
    leftMember: {
      articleId: string | null
    }
    rightMember: {
      articleId: string | null
    }
    signal: StoryClusterSignal
  }>
  members: Array<{
    articleId: string | null
    id: string
  }>
  version: number
}

export type StoryClusterReaderStore = {
  storyClusterVersion: {
    findMany(
      args: Record<string, unknown>
    ): Promise<StoryClusterVersionRecord[]>
  }
}

type ReaderArticleLoader = (input: {
  articleIds: string[]
  userId: string
}) => Promise<ReaderArticle[]>

type StoryClusterEvaluationDependencies = {
  getReaderArticle: (input: {
    articleId: string
    userId: string
  }) => Promise<ReaderArticle | null>
  listReaderArticles: (input: {
    limit: number
    userId: string
  }) => Promise<ReaderArticle[]>
  persistCandidate: (input: {
    candidate: StoryClusterCandidate
    userId: string
  }) => Promise<{
    created: boolean
    dismissed: boolean
  }>
}

export type StoryClusterEvaluationResult = {
  created: boolean
  dismissed: boolean
  matched: boolean
}

export class StoryClusterReaderError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "StoryClusterReaderError"
  }
}

/**
 * Runs the approved deterministic policy only after a signed-in reader asks
 * for related coverage. The input window is deliberately capped, and the
 * persistence layer rechecks every article's current visibility in its own
 * transaction before it writes a versioned cluster.
 */
export async function evaluateStoryClustersForArticleUser({
  articleId,
  userId
}: {
  articleId: string
  userId: string
}): Promise<StoryClusterEvaluationResult> {
  return evaluateStoryClustersForArticleUserWithDependencies({
    articleId,
    dependencies: {
      getReaderArticle: getReaderArticleForUser,
      listReaderArticles,
      persistCandidate: persistStoryClusterCandidateForUser
    },
    userId
  })
}

export async function evaluateStoryClustersForArticleUserWithDependencies({
  articleId,
  dependencies,
  userId
}: {
  articleId: string
  dependencies: StoryClusterEvaluationDependencies
  userId: string
}): Promise<StoryClusterEvaluationResult> {
  const normalizedArticleId = articleId.trim()
  const normalizedUserId = userId.trim()

  if (!normalizedArticleId || !normalizedUserId) {
    throw new StoryClusterReaderError("Choose an available article first.")
  }

  const selectedArticle = await dependencies.getReaderArticle({
    articleId: normalizedArticleId,
    userId: normalizedUserId
  })

  if (!selectedArticle) {
    throw new StoryClusterReaderError(
      "That article is not available in your active subscriptions."
    )
  }

  const readerArticles = await dependencies.listReaderArticles({
    limit: STORY_CLUSTER_READER_WINDOW_SIZE,
    userId: normalizedUserId
  })
  const candidate = buildStoryClusterCandidates(
    boundedReaderWindow(selectedArticle, readerArticles)
  ).find((entry) => entry.memberArticleIds.includes(selectedArticle.id))

  if (!candidate) {
    return { created: false, dismissed: false, matched: false }
  }

  try {
    const persisted = await dependencies.persistCandidate({
      candidate,
      userId: normalizedUserId
    })

    return {
      created: persisted.created,
      dismissed: persisted.dismissed,
      matched: true
    }
  } catch (error) {
    if (error instanceof StoryClusterPersistenceError) {
      throw new StoryClusterReaderError(error.message)
    }

    throw error
  }
}

/**
 * Reads only current, active versions for an article. Membership is hydrated
 * again through the reader access guard, so a saved snapshot never exposes a
 * source that was later paused, removed, or archived for this user.
 */
export async function listStoryClustersForArticleUser({
  articleId,
  userId
}: {
  articleId: string
  userId: string
}): Promise<StoryClusterPresentation[]> {
  return listStoryClustersForArticleUserWithClient({
    articleId,
    loadArticles: listReaderArticlesByIdsForUser,
    store: getPrisma() as unknown as StoryClusterReaderStore,
    userId
  })
}

export async function listStoryClustersForArticleUserWithClient({
  articleId,
  loadArticles,
  store,
  userId
}: {
  articleId: string
  loadArticles: ReaderArticleLoader
  store: StoryClusterReaderStore
  userId: string
}): Promise<StoryClusterPresentation[]> {
  const normalizedArticleId = articleId.trim()
  const normalizedUserId = userId.trim()

  if (!normalizedArticleId || !normalizedUserId) {
    return []
  }

  const versions = await store.storyClusterVersion.findMany({
    orderBy: [{ cluster: { updatedAt: "desc" } }, { version: "desc" }],
    select: {
      cluster: {
        select: {
          currentVersionNumber: true,
          id: true
        }
      },
      evidence: {
        select: {
          leftMember: {
            select: {
              articleId: true
            }
          },
          rightMember: {
            select: {
              articleId: true
            }
          },
          signal: true
        }
      },
      analyses: {
        orderBy: {
          createdAt: "desc"
        },
        select: {
          claims: {
            orderBy: {
              position: "asc"
            },
            select: {
              citations: {
                orderBy: {
                  position: "asc"
                },
                select: {
                  memberId: true,
                  position: true
                }
              },
              kind: true,
              position: true,
              statement: true
            }
          },
          model: true,
          provider: true,
          sourceCount: true
        },
        take: 1
      },
      members: {
        select: {
          articleId: true,
          id: true
        }
      },
      version: true
    },
    take: STORY_CLUSTER_VERSION_LOOKUP_LIMIT,
    where: {
      cluster: {
        status: "ACTIVE",
        userId: normalizedUserId
      },
      members: {
        some: {
          articleId: normalizedArticleId
        }
      }
    }
  })
  const currentVersions = versions
    .filter(
      (version) => version.version === version.cluster.currentVersionNumber
    )
    .slice(0, MAX_VISIBLE_STORY_CLUSTERS_PER_ARTICLE)

  if (!currentVersions.length) {
    return []
  }

  const visibleArticles = await loadArticles({
    articleIds: [
      ...new Set(
        currentVersions.flatMap((version) =>
          version.members.flatMap((member) =>
            member.articleId ? [member.articleId] : []
          )
        )
      )
    ],
    userId: normalizedUserId
  })
  const visibleArticlesById = new Map(
    visibleArticles.map((article) => [article.id, article])
  )

  return currentVersions.flatMap((version) => {
    const presentation = presentationFromVersion(version, visibleArticlesById)

    return presentation ? [presentation] : []
  })
}

function boundedReaderWindow(
  selectedArticle: ReaderArticle,
  readerArticles: ReaderArticle[]
) {
  const articleIds = new Set<string>()
  const window: ReaderArticle[] = []

  for (const article of [selectedArticle, ...readerArticles]) {
    if (articleIds.has(article.id)) {
      continue
    }

    articleIds.add(article.id)
    window.push(article)

    if (window.length === STORY_CLUSTER_READER_WINDOW_SIZE) {
      break
    }
  }

  return window
}

function presentationFromVersion(
  version: StoryClusterVersionRecord,
  visibleArticlesById: Map<string, ReaderArticle>
): StoryClusterPresentation | null {
  const members = version.members
    .flatMap((member) => {
      const article = member.articleId
        ? visibleArticlesById.get(member.articleId)
        : undefined

      return article
        ? [
            {
              articleId: article.id,
              feedTitle: article.feedTitle,
              memberId: member.id,
              publishedAt: article.publishedAt?.toISOString() ?? null,
              title: article.title,
              url: article.url
            }
          ]
        : []
    })
    .sort((left, right) => left.articleId.localeCompare(right.articleId))

  if (members.length < 2) {
    return null
  }

  const memberIds = new Set(members.map((member) => member.articleId))
  const evidence = version.evidence.filter((edge) => {
    const leftArticleId = edge.leftMember.articleId
    const rightArticleId = edge.rightMember.articleId

    return Boolean(
      leftArticleId &&
      rightArticleId &&
      memberIds.has(leftArticleId) &&
      memberIds.has(rightArticleId)
    )
  })
  const explainedMemberIds = new Set(
    evidence.flatMap((edge) => [
      edge.leftMember.articleId,
      edge.rightMember.articleId
    ])
  )

  if (members.some((member) => !explainedMemberIds.has(member.articleId))) {
    return null
  }

  const evidenceSignals = new Set(evidence.map((edge) => edge.signal))

  return {
    analysis: presentationAnalysis(
      version,
      new Set(members.map((member) => member.memberId))
    ),
    id: version.cluster.id,
    members,
    reasons: STORY_CLUSTER_SIGNALS.filter((signal) =>
      evidenceSignals.has(signal)
    )
  }
}

function presentationAnalysis(
  version: StoryClusterVersionRecord,
  visibleMemberIds: Set<string>
): StoryClusterAnalysisPresentation | null {
  const analysis = version.analyses[0]

  if (!analysis) {
    return null
  }

  const claims = analysis.claims
    .slice()
    .sort((left, right) => left.position - right.position)
    .flatMap((claim) => {
      const citations = claim.citations
        .slice()
        .sort((left, right) => left.position - right.position)
        .map((citation) => citation.memberId)
        .filter((memberId) => visibleMemberIds.has(memberId))

      return citations.length
        ? [
            {
              citations,
              kind: claim.kind,
              statement: claim.statement
            }
          ]
        : []
    })

  if (!claims.length) {
    return null
  }

  return {
    claims,
    model: analysis.model,
    provider: analysis.provider,
    sourceCount: analysis.sourceCount
  }
}

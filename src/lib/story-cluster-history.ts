export const STORY_CLUSTER_VERSION_ACTIONS = [
  "CREATED",
  "RERUN",
  "MERGED",
  "SPLIT",
  "DISMISSED",
  "RESTORED",
] as const

export type StoryClusterVersionAction =
  (typeof STORY_CLUSTER_VERSION_ACTIONS)[number]

// Keep this list aligned with StoryClusterSignal in the Prisma schema. These
// are user-visible, named reasons, never an opaque model score.
export const STORY_CLUSTER_SIGNALS = [
  "CANONICAL_URL",
  "NORMALIZED_TITLE",
  "PUBLICATION_TIME_WINDOW",
  "SHARED_NAMED_ENTITIES",
  "TEXT_SIMILARITY",
  "SOURCE_DUPLICATION",
] as const

export type StoryClusterSignal = (typeof STORY_CLUSTER_SIGNALS)[number]

export type StoryClusterMemberSnapshotInput = {
  articleId: string
  articleTitle: string
  articleUrl: string
  feedTitle: string
  publishedAt: Date | null
}

export type StoryClusterEvidenceInput = {
  leftArticleId: string
  rightArticleId: string
  signal: StoryClusterSignal
}

export type StoryClusterVersionSnapshot = {
  action: StoryClusterVersionAction
  deduplicationKey: string | null
  evidence: StoryClusterEvidenceInput[]
  members: StoryClusterMemberSnapshotInput[]
  version: number
}

type CreateStoryClusterVersionSnapshotInput = {
  action: StoryClusterVersionAction
  deduplicationKey?: string | null
  evidence: StoryClusterEvidenceInput[]
  members: StoryClusterMemberSnapshotInput[]
  previousVersionNumber: number
}

/**
 * Produces the immutable payload that will be persisted for one cluster
 * version. It deliberately makes every member traceable to at least one named
 * edge so a later UI can explain the grouping without reconstructing a score.
 */
export function createStoryClusterVersionSnapshot({
  action,
  deduplicationKey,
  evidence,
  members,
  previousVersionNumber,
}: CreateStoryClusterVersionSnapshotInput): StoryClusterVersionSnapshot {
  if (!STORY_CLUSTER_VERSION_ACTIONS.includes(action)) {
    throw new Error("An unknown cluster history action cannot be recorded.")
  }

  assertVersionTransition(action, previousVersionNumber)

  const normalizedDeduplicationKey = normalizeDeduplicationKey(deduplicationKey)
  if (action === "RERUN" && !normalizedDeduplicationKey) {
    throw new Error("A clustering rerun requires a deduplication key.")
  }

  const sortedMembers = normalizeMembers(members)
  const memberIds = new Set(sortedMembers.map((member) => member.articleId))
  const normalizedEvidence = normalizeEvidence(evidence, memberIds)
  assertEveryMemberIsExplained(sortedMembers, normalizedEvidence)

  return {
    action,
    deduplicationKey: normalizedDeduplicationKey,
    evidence: normalizedEvidence,
    members: sortedMembers,
    version: previousVersionNumber + 1,
  }
}

function assertVersionTransition(
  action: StoryClusterVersionAction,
  previousVersionNumber: number
) {
  if (!Number.isSafeInteger(previousVersionNumber) || previousVersionNumber < 0) {
    throw new Error("The previous cluster version must be a non-negative integer.")
  }

  if (action === "CREATED" && previousVersionNumber !== 0) {
    throw new Error("A cluster can only be created at version 1.")
  }

  if (action !== "CREATED" && previousVersionNumber === 0) {
    throw new Error("A cluster must be created before it can be changed.")
  }
}

function normalizeDeduplicationKey(value: string | null | undefined) {
  if (value === null || value === undefined) {
    return null
  }

  const normalized = value.trim()
  if (!normalized) {
    throw new Error("A deduplication key cannot be blank.")
  }

  return normalized
}

function normalizeMembers(members: StoryClusterMemberSnapshotInput[]) {
  if (members.length < 2) {
    throw new Error("A story cluster must contain at least two articles.")
  }

  const memberIds = new Set<string>()
  const normalizedMembers = members.map((member) => {
    assertNonBlank(member.articleId, "A cluster member requires an article ID.")
    assertNonBlank(member.articleTitle, "A cluster member requires an article title.")
    assertNonBlank(member.articleUrl, "A cluster member requires an article URL.")
    assertNonBlank(member.feedTitle, "A cluster member requires a feed title.")

    if (memberIds.has(member.articleId)) {
      throw new Error("A cluster version cannot contain the same article twice.")
    }
    memberIds.add(member.articleId)

    if (member.publishedAt && Number.isNaN(member.publishedAt.getTime())) {
      throw new Error("A cluster member cannot have an invalid publication date.")
    }

    return {
      ...member,
      publishedAt: member.publishedAt ? new Date(member.publishedAt) : null,
    }
  })

  return normalizedMembers.sort((left, right) =>
    left.articleId.localeCompare(right.articleId)
  )
}

function normalizeEvidence(
  evidence: StoryClusterEvidenceInput[],
  memberIds: Set<string>
) {
  if (evidence.length === 0) {
    throw new Error("A story cluster requires at least one visible grouping reason.")
  }

  const uniqueEvidence = new Set<string>()
  const normalizedEvidence = evidence.map((edge) => {
    assertNonBlank(edge.leftArticleId, "A grouping reason requires a left article.")
    assertNonBlank(edge.rightArticleId, "A grouping reason requires a right article.")

    if (edge.leftArticleId === edge.rightArticleId) {
      throw new Error("A grouping reason cannot compare an article with itself.")
    }

    if (!memberIds.has(edge.leftArticleId) || !memberIds.has(edge.rightArticleId)) {
      throw new Error("A grouping reason must only reference cluster members.")
    }

    if (!STORY_CLUSTER_SIGNALS.includes(edge.signal)) {
      throw new Error("An unknown grouping signal cannot be recorded.")
    }

    const [leftArticleId, rightArticleId] = [
      edge.leftArticleId,
      edge.rightArticleId,
    ].sort((left, right) => left.localeCompare(right))
    const key = `${leftArticleId}\u0000${rightArticleId}\u0000${edge.signal}`

    if (uniqueEvidence.has(key)) {
      throw new Error("A cluster version cannot repeat the same grouping reason.")
    }
    uniqueEvidence.add(key)

    return { leftArticleId, rightArticleId, signal: edge.signal }
  })

  return normalizedEvidence.sort((left, right) => {
    const leftKey = `${left.leftArticleId}\u0000${left.rightArticleId}\u0000${left.signal}`
    const rightKey = `${right.leftArticleId}\u0000${right.rightArticleId}\u0000${right.signal}`
    return leftKey.localeCompare(rightKey)
  })
}

function assertEveryMemberIsExplained(
  members: StoryClusterMemberSnapshotInput[],
  evidence: StoryClusterEvidenceInput[]
) {
  const explainedMemberIds = new Set(
    evidence.flatMap((edge) => [edge.leftArticleId, edge.rightArticleId])
  )

  if (members.some((member) => !explainedMemberIds.has(member.articleId))) {
    throw new Error("Every cluster member needs at least one visible grouping reason.")
  }
}

function assertNonBlank(value: string, message: string) {
  if (!value.trim()) {
    throw new Error(message)
  }
}

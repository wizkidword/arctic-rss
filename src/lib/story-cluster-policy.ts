import { createHash } from "node:crypto"

import type { StoryClusterEvidenceInput, StoryClusterSignal } from "./story-cluster-history"
import {
  storyIdentitySignals,
  storyPairEvidence,
  type StoryPairReason,
  type StorySignalArticle,
} from "./story-signals"

export const STORY_CLUSTER_POLICY_VERSION =
  "canonical-url-or-normalized-title-72h-v1"
export const STORY_CLUSTER_TITLE_TIME_WINDOW_MS = 72 * 60 * 60 * 1000

export type StoryClusterCandidateArticle = StorySignalArticle & {
  id: string
}

export type StoryClusterCandidate = {
  algorithmVersion: typeof STORY_CLUSTER_POLICY_VERSION
  deduplicationKey: string
  evidence: StoryClusterEvidenceInput[]
  memberArticleIds: string[]
}

/**
 * Applies the first approved, deterministic story policy to a caller-bounded
 * set of already-authorized articles. It only proposes groups: persistence,
 * scheduling, and reader presentation remain separate responsibilities.
 */
export function buildStoryClusterCandidates(
  articles: StoryClusterCandidateArticle[]
): StoryClusterCandidate[] {
  assertUniqueArticleIds(articles)

  const canonicalCandidates = canonicalUrlGroups(articles)
  const canonicalMemberIds = new Set(
    canonicalCandidates.flatMap((candidate) => candidate.memberArticleIds)
  )
  const titleCandidates = normalizedTitleGroups(
    articles.filter((article) => !canonicalMemberIds.has(article.id))
  )

  return [...canonicalCandidates, ...titleCandidates]
    .sort((left, right) =>
      left.memberArticleIds.join("\u0000").localeCompare(right.memberArticleIds.join("\u0000"))
    )
}

function canonicalUrlGroups(articles: StoryClusterCandidateArticle[]) {
  const groups = new Map<string, StoryClusterCandidateArticle[]>()

  for (const article of articles) {
    const canonicalUrl = storyIdentitySignals(article).canonicalUrl

    if (!canonicalUrl) {
      continue
    }

    const group = groups.get(canonicalUrl) ?? []
    group.push(article)
    groups.set(canonicalUrl, group)
  }

  return [...groups.values()]
    .filter((group) => group.length > 1)
    .map(candidateFromMembers)
}

function normalizedTitleGroups(articles: StoryClusterCandidateArticle[]) {
  const groups = new Map<string, StoryClusterCandidateArticle[]>()

  for (const article of articles) {
    const identity = storyIdentitySignals(article)

    if (!identity.normalizedTitle || !identity.publishedAt) {
      continue
    }

    const group = groups.get(identity.normalizedTitle) ?? []
    group.push(article)
    groups.set(identity.normalizedTitle, group)
  }

  return [...groups.values()].flatMap((group) => {
    const ordered = [...group].sort((left, right) => {
      const leftPublishedAt = storyIdentitySignals(left).publishedAt!.getTime()
      const rightPublishedAt = storyIdentitySignals(right).publishedAt!.getTime()

      return leftPublishedAt - rightPublishedAt || left.id.localeCompare(right.id)
    })
    const candidates: StoryClusterCandidate[] = []
    let window: StoryClusterCandidateArticle[] = []

    for (const article of ordered) {
      const firstPublishedAt = window.length
        ? storyIdentitySignals(window[0]).publishedAt!.getTime()
        : null
      const publishedAt = storyIdentitySignals(article).publishedAt!.getTime()

      if (
        firstPublishedAt !== null &&
        publishedAt - firstPublishedAt > STORY_CLUSTER_TITLE_TIME_WINDOW_MS
      ) {
        if (window.length > 1) {
          candidates.push(candidateFromMembers(window))
        }
        window = []
      }

      window.push(article)
    }

    if (window.length > 1) {
      candidates.push(candidateFromMembers(window))
    }

    return candidates
  })
}

function candidateFromMembers(members: StoryClusterCandidateArticle[]) {
  const sortedMembers = [...members].sort((left, right) => left.id.localeCompare(right.id))
  const evidence = pairwiseEvidence(sortedMembers)
  const memberArticleIds = sortedMembers.map((member) => member.id)

  return {
    algorithmVersion: STORY_CLUSTER_POLICY_VERSION,
    deduplicationKey: candidateDeduplicationKey(memberArticleIds, evidence),
    evidence,
    memberArticleIds,
  } satisfies StoryClusterCandidate
}

function pairwiseEvidence(members: StoryClusterCandidateArticle[]) {
  return members
    .flatMap((left, leftIndex) =>
      members.slice(leftIndex + 1).flatMap((right) => {
        const evidence = storyPairEvidence(left, right, {
          timeWindowMs: STORY_CLUSTER_TITLE_TIME_WINDOW_MS,
        })

        return evidence.reasons.map((reason) =>
          normalizeEvidence({
            leftArticleId: left.id,
            rightArticleId: right.id,
            signal: reasonToClusterSignal(reason),
          })
        )
      })
    )
    .sort(compareEvidence)
}

function assertUniqueArticleIds(articles: StoryClusterCandidateArticle[]) {
  const articleIds = new Set<string>()

  for (const article of articles) {
    if (!article.id.trim()) {
      throw new Error("A story-cluster candidate article requires an ID.")
    }

    if (articleIds.has(article.id)) {
      throw new Error("A story-cluster candidate set cannot repeat an article.")
    }

    articleIds.add(article.id)
  }
}

function reasonToClusterSignal(reason: StoryPairReason): StoryClusterSignal {
  switch (reason.code) {
    case "canonical_url":
      return "CANONICAL_URL"
    case "normalized_title":
      return "NORMALIZED_TITLE"
    case "publication_time_window":
      return "PUBLICATION_TIME_WINDOW"
  }
}

function normalizeEvidence(evidence: StoryClusterEvidenceInput): StoryClusterEvidenceInput {
  const [leftArticleId, rightArticleId] = [
    evidence.leftArticleId,
    evidence.rightArticleId,
  ].sort((left, right) => left.localeCompare(right))

  return { ...evidence, leftArticleId, rightArticleId }
}

function compareEvidence(
  left: StoryClusterEvidenceInput,
  right: StoryClusterEvidenceInput
) {
  return evidenceKey(left).localeCompare(evidenceKey(right))
}

function candidateDeduplicationKey(
  memberArticleIds: string[],
  evidence: StoryClusterEvidenceInput[]
) {
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        algorithmVersion: STORY_CLUSTER_POLICY_VERSION,
        evidence,
        memberArticleIds,
      })
    )
    .digest("hex")

  return `story-cluster:${STORY_CLUSTER_POLICY_VERSION}:${fingerprint}`
}

function evidenceKey(evidence: StoryClusterEvidenceInput) {
  return `${evidence.leftArticleId}\u0000${evidence.rightArticleId}\u0000${evidence.signal}`
}

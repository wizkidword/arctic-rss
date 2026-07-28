const MAX_STORY_TITLE_LENGTH = 500

export type StorySignalArticle = {
  canonicalUrl?: string | null
  publishedAt?: Date | null
  title: string
  url: string
}

export type StoryIdentitySignals = {
  canonicalUrl: string | null
  normalizedTitle: string | null
  publishedAt: Date | null
}

export type StoryPairEvidence = {
  canonicalUrlMatches: boolean
  normalizedTitleMatches: boolean
  publishedWithinWindow: boolean
  reasons: StoryPairReason[]
}

export type StoryPairReason = {
  code: "canonical_url" | "normalized_title" | "publication_time_window"
  description: string
}

export function storyIdentitySignals(
  article: StorySignalArticle
): StoryIdentitySignals {
  return {
    canonicalUrl: normalizeStoryUrl(article.canonicalUrl) ?? normalizeStoryUrl(article.url),
    normalizedTitle: normalizeStoryTitle(article.title),
    publishedAt: normalizePublishedAt(article.publishedAt),
  }
}

/**
 * Produces the visible evidence for a future clustering decision. It never
 * returns a score or a grouping verdict: callers must retain the reasons that
 * led to a merge, and a later policy can require more than one signal.
 */
export function storyPairEvidence(
  left: StorySignalArticle,
  right: StorySignalArticle,
  {
    timeWindowMs,
  }: {
    timeWindowMs: number
  }
): StoryPairEvidence {
  const leftSignals = storyIdentitySignals(left)
  const rightSignals = storyIdentitySignals(right)
  const canonicalUrlMatches =
    Boolean(leftSignals.canonicalUrl) &&
    leftSignals.canonicalUrl === rightSignals.canonicalUrl
  const normalizedTitleMatches =
    Boolean(leftSignals.normalizedTitle) &&
    leftSignals.normalizedTitle === rightSignals.normalizedTitle
  const publishedWithinWindow = arePublishedWithinStoryWindow(
    leftSignals.publishedAt,
    rightSignals.publishedAt,
    timeWindowMs
  )
  const reasons: StoryPairReason[] = []

  if (canonicalUrlMatches) {
    reasons.push({
      code: "canonical_url",
      description: "Both articles resolve to the same canonical URL.",
    })
  }

  if (normalizedTitleMatches) {
    reasons.push({
      code: "normalized_title",
      description: "Both articles have the same normalized title.",
    })
  }

  if (publishedWithinWindow) {
    reasons.push({
      code: "publication_time_window",
      description: "Both articles were published within the configured time window.",
    })
  }

  return {
    canonicalUrlMatches,
    normalizedTitleMatches,
    publishedWithinWindow,
    reasons,
  }
}

export function normalizeStoryUrl(value: string | null | undefined) {
  const input = value?.trim()

  if (!input) {
    return null
  }

  let url: URL

  try {
    url = new URL(input)
  } catch {
    return null
  }

  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username ||
    url.password
  ) {
    return null
  }

  url.hash = ""

  const trackingParameters = [...url.searchParams.keys()].filter(
    isTrackingParameter
  )

  for (const name of trackingParameters) {
    url.searchParams.delete(name)
  }

  return url.href
}

export function normalizeStoryTitle(value: string | null | undefined) {
  const normalized = (value ?? "")
    .normalize("NFKC")
    .slice(0, MAX_STORY_TITLE_LENGTH)
    .toLocaleLowerCase("en-US")
    .replace(/[.'’]/g, "")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()

  return normalized || null
}

function arePublishedWithinStoryWindow(
  left: Date | null,
  right: Date | null,
  timeWindowMs: number
) {
  if (!left || !right || !Number.isFinite(timeWindowMs) || timeWindowMs < 0) {
    return false
  }

  return Math.abs(left.getTime() - right.getTime()) <= timeWindowMs
}

function normalizePublishedAt(value: Date | null | undefined) {
  return value && !Number.isNaN(value.getTime()) ? value : null
}

function isTrackingParameter(name: string) {
  const normalized = name.toLowerCase()

  return (
    normalized.startsWith("utm_") ||
    normalized === "fbclid" ||
    normalized === "gclid" ||
    normalized === "mc_cid" ||
    normalized === "mc_eid"
  )
}

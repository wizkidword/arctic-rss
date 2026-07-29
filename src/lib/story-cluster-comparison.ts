export type StoryClusterComparableSource = {
  articleId: string
  feedTitle: string
  publishedAt: string | null
  title: string
  url: string
}

export type StoryClusterTimelineComparison = {
  firstKnownSource: StoryClusterComparableSource | null
  latestKnownSource: StoryClusterComparableSource | null
  sourcesByPublication: StoryClusterComparableSource[]
}

/**
 * Produces a deterministic source timeline from reader-authorized article
 * metadata. It deliberately does not infer facts, corrections, or source
 * agreement from headlines alone; those claims require a separately cited
 * evidence model.
 */
export function buildStoryClusterTimelineComparison(
  sources: StoryClusterComparableSource[]
): StoryClusterTimelineComparison {
  const sourcesByPublication = [...sources].sort(comparePublication)
  const datedSources = sourcesByPublication.filter((source) =>
    publicationTime(source.publishedAt) !== null
  )

  return {
    firstKnownSource: datedSources[0] ?? null,
    latestKnownSource: datedSources.at(-1) ?? null,
    sourcesByPublication,
  }
}

function comparePublication(
  left: StoryClusterComparableSource,
  right: StoryClusterComparableSource
) {
  const leftTime = publicationTime(left.publishedAt)
  const rightTime = publicationTime(right.publishedAt)

  if (leftTime === null && rightTime === null) {
    return left.articleId.localeCompare(right.articleId)
  }

  if (leftTime === null) {
    return 1
  }

  if (rightTime === null) {
    return -1
  }

  return leftTime - rightTime || left.articleId.localeCompare(right.articleId)
}

function publicationTime(value: string | null) {
  if (!value) {
    return null
  }

  const time = new Date(value).getTime()

  return Number.isFinite(time) ? time : null
}

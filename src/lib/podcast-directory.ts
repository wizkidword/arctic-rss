import {
  podcastDirectoryCategories,
  podcastDirectoryShows,
} from "@/data/podcast-directory"

export type PodcastDirectoryCategory =
  (typeof podcastDirectoryCategories)[number]
export type PodcastDirectoryShow = (typeof podcastDirectoryShows)[number]

const categoryLabels = new Map(
  podcastDirectoryCategories.map((category) => [category.id, category.label])
)

export function listPodcastDirectoryCategories() {
  return [...podcastDirectoryCategories]
}

export function listPodcastDirectoryShows(categoryId?: string) {
  return podcastDirectoryShows.filter((show) =>
    categoryId ? show.categoryId === categoryId : true
  )
}

export function getPodcastDirectoryShow(showId: string) {
  return podcastDirectoryShows.find((show) => show.id === showId)
}

export function searchPodcastDirectory(query: string) {
  const normalizedQuery = normalizeSearchText(query)

  if (!normalizedQuery) {
    return [...podcastDirectoryShows]
  }

  return podcastDirectoryShows.filter((show) =>
    searchablePodcastText(show).includes(normalizedQuery)
  )
}

function searchablePodcastText(show: PodcastDirectoryShow) {
  return normalizeSearchText(
    [
      show.author,
      show.categoryId,
      categoryLabels.get(show.categoryId),
      show.description,
      show.title,
    ].join(" ")
  )
}

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

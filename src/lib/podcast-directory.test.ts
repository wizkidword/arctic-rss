import { describe, expect, it } from "vitest"

import {
  getPodcastDirectoryShow,
  listPodcastDirectoryCategories,
  listPodcastDirectoryShows,
  searchPodcastDirectory,
} from "./podcast-directory"

describe("podcast directory", () => {
  it("lists broad curated categories", () => {
    expect(listPodcastDirectoryCategories().map((category) => category.id))
      .toEqual([
        "ai",
        "archaeology",
        "arts",
        "books",
        "business",
        "careers",
        "comedy",
        "culture",
        "cybersecurity",
        "economics",
        "education",
        "entertainment",
        "entrepreneurship",
        "food",
        "gaming",
        "health",
        "history",
        "language-learning",
        "law",
        "marketing",
        "medicine",
        "music",
        "news",
        "parenting",
        "personal-finance",
        "philosophy",
        "politics",
        "science",
        "space",
        "sports",
        "technology",
        "travel",
        "true-crime",
        "writing",
      ])
  })

  it("keeps each category populated with verified podcast RSS feeds", () => {
    const categories = listPodcastDirectoryCategories()
    const shows = listPodcastDirectoryShows()
    const feedUrls = new Set(shows.map((show) => show.feedUrl))

    expect(feedUrls.size).toBe(shows.length)

    for (const category of categories) {
      const categoryShows = listPodcastDirectoryShows(category.id)

      expect(categoryShows.length).toBeGreaterThanOrEqual(3)
      expect(categoryShows.length).toBeLessThanOrEqual(6)
      expect(categoryShows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            artworkUrl: expect.stringMatching(/^https:\/\//),
            categoryId: category.id,
            description: expect.any(String),
            feedUrl: expect.stringMatching(/^https?:\/\//),
            id: expect.any(String),
            title: expect.any(String),
          }),
        ])
      )
    }
  })

  it("lists shows by category without mutating directory data", () => {
    const technologyShows = listPodcastDirectoryShows("technology")
    const originalFirstTitle = technologyShows[0]?.title

    technologyShows.pop()

    expect(listPodcastDirectoryShows("technology")[0]?.title).toBe(
      originalFirstTitle
    )
  })

  it("searches curated podcasts by title, description, author, and category", () => {
    expect(searchPodcastDirectory("technology")[0]).toEqual(
      expect.objectContaining({
        categoryId: "technology",
        feedUrl: expect.stringMatching(/^https?:\/\//),
        title: expect.any(String),
      })
    )

    expect(searchPodcastDirectory("startup").map((show) => show.id)).toContain(
      "how-i-built-this"
    )

    expect(searchPodcastDirectory("nasa").map((show) => show.id)).toContain(
      "nasas-curious-universe"
    )
  })

  it("returns a show by id", () => {
    expect(getPodcastDirectoryShow("planet-money")).toEqual(
      expect.objectContaining({
        categoryId: "business",
        feedUrl: "https://feeds.npr.org/510289/podcast.xml",
        title: "Planet Money",
      })
    )

    expect(getPodcastDirectoryShow("missing")).toBeUndefined()
  })
})

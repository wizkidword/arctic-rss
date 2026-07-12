import { describe, expect, it } from "vitest"

import {
  getCategoryCountryCode,
  getNationShortcuts,
  mergeDiscoverDirectory,
} from "./discover-directory"

describe("discover directory merging", () => {
  it("keeps non-nation imported categories out of the nation shortcut bar", () => {
    const directory = mergeDiscoverDirectory({
      dynamicCategories: [
        {
          countryCode: null,
          description: "Independent podcast feeds.",
          id: "opml-podcasts",
          label: "Podcasts",
          sortOrder: 0,
        },
      ],
      dynamicFeeds: [
        {
          aliases: [],
          categoryId: "opml-podcasts",
          id: "opml-podcasts-daily-audio",
          label: "Daily Audio",
          source: "podcasts.example",
          sortOrder: 0,
          url: "https://podcasts.example/feed.xml",
        },
      ],
    })

    expect(directory.categories).toContainEqual(
      expect.objectContaining({
        countryCode: null,
        id: "opml-podcasts",
        label: "Podcasts",
      })
    )
    expect(directory.feeds).toContainEqual(
      expect.objectContaining({
        categoryId: "opml-podcasts",
        id: "opml-podcasts-daily-audio",
      })
    )
    expect(getNationShortcuts(directory.categories)).not.toContainEqual({
      id: "opml",
      label: "OPML",
    })
  })

  it("adds shortcut buttons only for categories with a country code", () => {
    const directory = mergeDiscoverDirectory({
      dynamicCategories: [
        {
          countryCode: "zz",
          description: "Nation-backed feeds.",
          id: "zz-general",
          label: "ZZ General",
          sortOrder: 0,
        },
        {
          countryCode: null,
          description: "Topic-only feeds.",
          id: "opml-finance",
          label: "Finance",
          sortOrder: 1,
        },
      ],
      dynamicFeeds: [],
    })

    expect(getNationShortcuts(directory.categories)).toEqual([
      { id: "us", label: "US" },
      { id: "ca", label: "CA" },
      { id: "in", label: "IN" },
      { id: "gb", label: "GB" },
      { id: "au", label: "AU" },
      { id: "bd", label: "BD" },
      { id: "zz", label: "ZZ" },
    ])
  })

  it("infers nation shortcuts from any two-letter category prefix", () => {
    const category = {
      countryCode: null,
      id: "de-general",
    }

    expect(getCategoryCountryCode(category)).toBe("de")
    expect(getNationShortcuts([category])).toEqual([{ id: "de", label: "DE" }])
  })

  it("infers nation shortcuts from exact imported country labels", () => {
    const category = {
      countryCode: null,
      id: "opml-united-states",
      label: "United States",
    }

    expect(getCategoryCountryCode(category)).toBe("us")
    expect(getNationShortcuts([category])).toEqual([{ id: "us", label: "US" }])
  })

  it("applies edited descriptions and icons to static and imported category cards", () => {
    const directory = mergeDiscoverDirectory({
      categoryCustomizations: [
        {
          categoryId: "us-general",
          description: "A custom national news shelf.",
          iconKey: "world",
        },
        {
          categoryId: "opml-podcasts",
          description: "Curated listening feeds.",
          iconKey: "audio",
        },
      ],
      dynamicCategories: [
        {
          countryCode: null,
          description: "Independent podcast feeds.",
          id: "opml-podcasts",
          label: "Podcasts",
          sortOrder: 0,
        },
      ],
      dynamicFeeds: [],
    })

    expect(
      directory.categories.find((category) => category.id === "us-general")
    ).toMatchObject({
      description: "A custom national news shelf.",
      iconKey: "world",
    })
    expect(
      directory.categories.find((category) => category.id === "opml-podcasts")
    ).toMatchObject({
      description: "Curated listening feeds.",
      iconKey: "audio",
    })
  })

  it("assigns topic-specific default icons to imported OPML categories", () => {
    const directory = mergeDiscoverDirectory({
      dynamicCategories: [
        {
          countryCode: null,
          description: "Android development feeds.",
          id: "opml-android-develpment",
          label: "Android Develpment",
          sortOrder: 0,
        },
        {
          countryCode: null,
          description: "Fashion feeds.",
          id: "opml-fasion",
          label: "Fasion",
          sortOrder: 1,
        },
      ],
      dynamicFeeds: [],
    })

    expect(
      directory.categories.find(
        (category) => category.id === "opml-android-develpment"
      )
    ).toMatchObject({
      iconKey: "android-development",
    })
    expect(
      directory.categories.find((category) => category.id === "opml-fasion")
    ).toMatchObject({
      iconKey: "fashion",
    })
  })

  it("includes the built-in Reddit topic and folds admin-added subreddits into it", () => {
    const directory = mergeDiscoverDirectory({
      dynamicCategories: [
        {
          countryCode: null,
          description: "Subreddit feeds added by administrators.",
          id: "reddit",
          label: "Reddit",
          sortOrder: 10_000,
        },
      ],
      dynamicFeeds: [
        {
          aliases: [],
          categoryId: "reddit",
          id: "reddit-localhistory",
          label: "r/localhistory",
          source: "reddit.com",
          sortOrder: 10_000,
          url: "https://www.reddit.com/r/localhistory/.rss",
        },
      ],
    })
    const redditCategories = directory.categories.filter(
      (category) => category.id === "reddit"
    )

    expect(redditCategories).toHaveLength(1)
    expect(redditCategories[0]).toMatchObject({
      countryCode: null,
      iconKey: "reddit",
      label: "Reddit",
    })
    expect(
      directory.feeds.filter((feed) => feed.categoryId === "reddit")
    ).toHaveLength(51)
    expect(directory.feeds).toContainEqual(
      expect.objectContaining({
        id: "reddit-localhistory",
        label: "r/localhistory",
      })
    )
    expect(getNationShortcuts(directory.categories)).not.toContainEqual({
      id: "reddit",
      label: "REDDIT",
    })
  })
})

import { describe, expect, it } from "vitest"

import {
  createDiscoverInterestGroups,
  listDiscoverInterestFeeds,
} from "./discover-interests"
import type { DiscoverDirectory } from "./discover-directory"

const directory = {
  categories: [
    {
      countryCode: "us",
      description: "U.S. national news.",
      iconKey: "general",
      id: "us-general",
      label: "US General",
      sortOrder: 0,
    },
    {
      countryCode: "ca",
      description: "Canadian national news.",
      iconKey: "general",
      id: "ca-general",
      label: "CA General",
      sortOrder: 1,
    },
    {
      countryCode: "bd",
      description: "Bangladeshi national news.",
      iconKey: "general",
      id: "bangladesh-general",
      label: "Bangladesh General",
      sortOrder: 2,
    },
    {
      countryCode: null,
      description: "AU Australia RSS feeds imported from OPML.",
      iconKey: "general",
      id: "au-australia",
      label: "Australia",
      sortOrder: 3,
    },
    {
      countryCode: null,
      description: "Independent audio feeds.",
      iconKey: "audio",
      id: "opml-podcasts",
      label: "Podcasts",
      sortOrder: 4,
    },
  ],
  feeds: [
    {
      aliases: [],
      categoryId: "us-general",
      id: "us-a",
      label: "U.S. A",
      source: "example.com",
      sortOrder: 0,
      url: "https://example.com/us-a.xml",
    },
    {
      aliases: ["https://example.com/ca-a-old.xml"],
      categoryId: "ca-general",
      id: "ca-a",
      label: "Canada A",
      source: "example.ca",
      sortOrder: 1,
      url: "https://example.com/ca-a.xml",
    },
    {
      aliases: [],
      categoryId: "ca-general",
      id: "ca-b",
      label: "Canada B",
      source: "example.ca",
      sortOrder: 2,
      url: "https://example.com/ca-b.xml",
    },
    {
      aliases: [],
      categoryId: "bangladesh-general",
      id: "bd-a",
      label: "Bangladesh A",
      source: "example.com.bd",
      sortOrder: 3,
      url: "https://example.com/bd-a.xml",
    },
    {
      aliases: [],
      categoryId: "au-australia",
      id: "au-a",
      label: "Australia A",
      source: "example.com.au",
      sortOrder: 4,
      url: "https://example.com/au-a.xml",
    },
    {
      aliases: [],
      categoryId: "opml-podcasts",
      id: "daily-audio",
      label: "Daily Audio",
      source: "podcasts.example",
      sortOrder: 6,
      url: "https://podcasts.example/feed.xml",
    },
  ],
} satisfies DiscoverDirectory

describe("discover interests", () => {
  it("groups nation-prefixed categories by shared interest", () => {
    const groups = createDiscoverInterestGroups(directory)

    expect(groups).toContainEqual(
      expect.objectContaining({
        categoryCount: 4,
        description: "Headlines and reporting from national and regional outlets.",
        feedCount: 5,
        id: "general",
        label: "General",
      })
    )
    expect(groups).toContainEqual(
      expect.objectContaining({
        categoryCount: 1,
        feedCount: 1,
        id: "podcasts",
        label: "Podcasts",
      })
    )
    expect(groups).not.toContainEqual(
      expect.objectContaining({
        id: "bangladesh-general",
        label: "Bangladesh General",
      })
    )
    expect(groups).not.toContainEqual(
      expect.objectContaining({
        id: "australia",
        label: "Australia",
      })
    )
  })

  it("returns every feed for an interest in directory order", () => {
    const feeds = listDiscoverInterestFeeds({
      categories: directory.categories,
      feeds: directory.feeds,
      interestId: "general",
    })

    expect(feeds.map((feed) => feed.id)).toEqual([
      "us-a",
      "ca-a",
      "ca-b",
      "bd-a",
      "au-a",
    ])
  })

  it("keeps UI / UX labels intact for non-country topic imports", () => {
    const groups = createDiscoverInterestGroups({
      categories: [
        {
          countryCode: null,
          description: "Product design and user experience feeds.",
          iconKey: "ui-ux",
          id: "opml-ui-ux",
          label: "UI / UX",
          sortOrder: 0,
        },
      ],
      feeds: [
        {
          aliases: [],
          categoryId: "opml-ui-ux",
          id: "opml-ui-ux-design-feed",
          label: "Design Feed",
          source: "design.example",
          sortOrder: 0,
          url: "https://design.example/feed.xml",
        },
      ],
    })

    expect(groups).toEqual([
      expect.objectContaining({
        feedCount: 1,
        id: "ui-ux",
        label: "UI / UX",
      }),
    ])
  })

  it("keeps AI as a preferred acronym topic with its own description", () => {
    const groups = createDiscoverInterestGroups({
      categories: [
        {
          countryCode: null,
          description: "Artificial intelligence feeds.",
          iconKey: "ai",
          id: "ai",
          label: "AI",
          sortOrder: 100,
        },
        {
          countryCode: "us",
          description: "U.S. science feeds.",
          iconKey: "science",
          id: "us-science",
          label: "US Science",
          sortOrder: 0,
        },
        {
          countryCode: "us",
          description: "U.S. tech feeds.",
          iconKey: "tech",
          id: "us-tech",
          label: "US Tech",
          sortOrder: 1,
        },
      ],
      feeds: [
        {
          aliases: [],
          categoryId: "ai",
          id: "ai-feed",
          label: "AI Feed",
          source: "ai.example",
          sortOrder: 0,
          url: "https://ai.example/feed.xml",
        },
        {
          aliases: [],
          categoryId: "us-science",
          id: "science-feed",
          label: "Science Feed",
          source: "science.example",
          sortOrder: 1,
          url: "https://science.example/feed.xml",
        },
        {
          aliases: [],
          categoryId: "us-tech",
          id: "tech-feed",
          label: "Tech Feed",
          source: "tech.example",
          sortOrder: 2,
          url: "https://tech.example/feed.xml",
        },
      ],
    })

    expect(groups.map((group) => group.id)).toEqual(["ai", "science", "tech"])
    expect(groups).toContainEqual(
      expect.objectContaining({
        categoryCount: 1,
        description:
          "Artificial intelligence news, research, models, tools, policy, and machine-learning coverage.",
        feedCount: 1,
        iconKey: "ai",
        id: "ai",
        label: "AI",
      })
    )
  })

  it("keeps curated evergreen topics as first-class interests", () => {
    const groups = createDiscoverInterestGroups({
      categories: [
        {
          countryCode: null,
          description: "Marketing feeds.",
          iconKey: "marketing",
          id: "marketing",
          label: "Marketing",
          sortOrder: 0,
        },
        {
          countryCode: null,
          description: "Comics feeds.",
          iconKey: "comics",
          id: "comics",
          label: "Comics",
          sortOrder: 1,
        },
        {
          countryCode: null,
          description: "Food feeds.",
          iconKey: "food",
          id: "food",
          label: "Food",
          sortOrder: 2,
        },
        {
          countryCode: null,
          description: "Design feeds.",
          iconKey: "design",
          id: "design",
          label: "Design",
          sortOrder: 3,
        },
        {
          countryCode: null,
          description: "Torrenting feeds.",
          iconKey: "torrenting",
          id: "torrenting",
          label: "Torrenting",
          sortOrder: 4,
        },
        {
          countryCode: null,
          description: "Advertising feeds.",
          iconKey: "advertising",
          id: "advertising",
          label: "Advertising",
          sortOrder: 5,
        },
        {
          countryCode: null,
          description: "Biopharma feeds.",
          iconKey: "biopharma",
          id: "biopharma",
          label: "Biopharma",
          sortOrder: 6,
        },
        {
          countryCode: null,
          description: "Cybersecurity feeds.",
          iconKey: "cybersecurity",
          id: "cybersecurity",
          label: "Cybersecurity",
          sortOrder: 7,
        },
        {
          countryCode: null,
          description: "Energy feeds.",
          iconKey: "energy",
          id: "energy",
          label: "Energy",
          sortOrder: 8,
        },
        {
          countryCode: null,
          description: "Healthcare feeds.",
          iconKey: "healthcare",
          id: "healthcare",
          label: "Healthcare",
          sortOrder: 9,
        },
        {
          countryCode: null,
          description: "Real estate feeds.",
          iconKey: "real-estate",
          id: "real-estate",
          label: "Real Estate",
          sortOrder: 10,
        },
        {
          countryCode: null,
          description: "Retail feeds.",
          iconKey: "retail",
          id: "retail",
          label: "Retail",
          sortOrder: 11,
        },
        {
          countryCode: null,
          description: "Travel and hospitality feeds.",
          iconKey: "travel-hospitality",
          id: "travel-hospitality",
          label: "Travel & Hospitality",
          sortOrder: 12,
        },
      ],
      feeds: [
        {
          aliases: [],
          categoryId: "marketing",
          id: "marketing-feed",
          label: "Marketing Feed",
          source: "marketing.example",
          sortOrder: 0,
          url: "https://marketing.example/feed.xml",
        },
        {
          aliases: [],
          categoryId: "comics",
          id: "comics-feed",
          label: "Comics Feed",
          source: "comics.example",
          sortOrder: 1,
          url: "https://comics.example/feed.xml",
        },
        {
          aliases: [],
          categoryId: "food",
          id: "food-feed",
          label: "Food Feed",
          source: "food.example",
          sortOrder: 2,
          url: "https://food.example/feed.xml",
        },
        {
          aliases: [],
          categoryId: "design",
          id: "design-feed",
          label: "Design Feed",
          source: "design.example",
          sortOrder: 3,
          url: "https://design.example/feed.xml",
        },
        {
          aliases: [],
          categoryId: "torrenting",
          id: "torrenting-feed",
          label: "Torrenting Feed",
          source: "torrenting.example",
          sortOrder: 4,
          url: "https://torrenting.example/feed.xml",
        },
        {
          aliases: [],
          categoryId: "advertising",
          id: "advertising-feed",
          label: "Advertising Feed",
          source: "advertising.example",
          sortOrder: 5,
          url: "https://advertising.example/feed.xml",
        },
        {
          aliases: [],
          categoryId: "biopharma",
          id: "biopharma-feed",
          label: "Biopharma Feed",
          source: "biopharma.example",
          sortOrder: 6,
          url: "https://biopharma.example/feed.xml",
        },
        {
          aliases: [],
          categoryId: "cybersecurity",
          id: "cybersecurity-feed",
          label: "Cybersecurity Feed",
          source: "cybersecurity.example",
          sortOrder: 7,
          url: "https://cybersecurity.example/feed.xml",
        },
        {
          aliases: [],
          categoryId: "energy",
          id: "energy-feed",
          label: "Energy Feed",
          source: "energy.example",
          sortOrder: 8,
          url: "https://energy.example/feed.xml",
        },
        {
          aliases: [],
          categoryId: "healthcare",
          id: "healthcare-feed",
          label: "Healthcare Feed",
          source: "healthcare.example",
          sortOrder: 9,
          url: "https://healthcare.example/feed.xml",
        },
        {
          aliases: [],
          categoryId: "real-estate",
          id: "real-estate-feed",
          label: "Real Estate Feed",
          source: "real-estate.example",
          sortOrder: 10,
          url: "https://real-estate.example/feed.xml",
        },
        {
          aliases: [],
          categoryId: "retail",
          id: "retail-feed",
          label: "Retail Feed",
          source: "retail.example",
          sortOrder: 11,
          url: "https://retail.example/feed.xml",
        },
        {
          aliases: [],
          categoryId: "travel-hospitality",
          id: "travel-hospitality-feed",
          label: "Travel Hospitality Feed",
          source: "travel-hospitality.example",
          sortOrder: 12,
          url: "https://travel-hospitality.example/feed.xml",
        },
      ],
    })

    expect(groups.map((group) => group.id)).toEqual([
      "advertising",
      "biopharma",
      "comics",
      "cybersecurity",
      "design",
      "energy",
      "food",
      "healthcare",
      "marketing",
      "real-estate",
      "retail",
      "torrenting",
      "travel-hospitality",
    ])
    expect(groups).toContainEqual(
      expect.objectContaining({
        description:
          "Advertising, media buying, creative campaigns, ad tech, and brand marketing coverage.",
        iconKey: "advertising",
        id: "advertising",
      })
    )
    expect(groups).toContainEqual(
      expect.objectContaining({
        description:
          "Marketing strategy, SEO, social media, content, and growth coverage.",
        feedCount: 1,
        iconKey: "marketing",
        id: "marketing",
        label: "Marketing",
      })
    )
    expect(groups).toContainEqual(
      expect.objectContaining({
        description:
          "Webcomics, comic culture, industry news, and graphic storytelling.",
        iconKey: "comics",
        id: "comics",
      })
    )
    expect(groups).toContainEqual(
      expect.objectContaining({
        description:
          "Product design, UX, visual design, architecture, and creative culture.",
        iconKey: "design",
        id: "design",
      })
    )
    expect(groups).toContainEqual(
      expect.objectContaining({
        description:
          "BitTorrent news, open-source client releases, and legal open-download sources.",
        iconKey: "torrenting",
        id: "torrenting",
        label: "Torrenting",
      })
    )
    expect(groups).toContainEqual(
      expect.objectContaining({
        description:
          "Healthcare business, hospitals, policy, digital health, and care delivery.",
        iconKey: "healthcare",
        id: "healthcare",
      })
    )
    expect(groups).toContainEqual(
      expect.objectContaining({
        description:
          "Travel, hotels, airlines, tourism, hospitality operations, and guest experience.",
        iconKey: "travel-hospitality",
        id: "travel-hospitality",
        label: "Travel & Hospitality",
      })
    )
  })

  it("keeps earth history and sport league topics as first-class interests", () => {
    const groups = createDiscoverInterestGroups({
      categories: [
        {
          countryCode: null,
          description: "Archaeology feeds.",
          iconKey: "science",
          id: "archaeology",
          label: "Archaeology",
          sortOrder: 0,
        },
        {
          countryCode: null,
          description: "Geology feeds.",
          iconKey: "science",
          id: "geology",
          label: "Geology",
          sortOrder: 1,
        },
        {
          countryCode: null,
          description: "MMA feeds.",
          iconKey: "sports",
          id: "mma",
          label: "MMA",
          sortOrder: 2,
        },
        {
          countryCode: null,
          description: "Boxing feeds.",
          iconKey: "sports",
          id: "boxing",
          label: "Boxing",
          sortOrder: 3,
        },
        {
          countryCode: null,
          description: "American football feeds.",
          iconKey: "sports",
          id: "american-football",
          label: "American Football",
          sortOrder: 4,
        },
        {
          countryCode: null,
          description: "Basketball feeds.",
          iconKey: "sports",
          id: "basketball",
          label: "Basketball",
          sortOrder: 5,
        },
        {
          countryCode: null,
          description: "Baseball feeds.",
          iconKey: "sports",
          id: "baseball",
          label: "Baseball",
          sortOrder: 6,
        },
        {
          countryCode: null,
          description: "Hockey feeds.",
          iconKey: "sports",
          id: "hockey",
          label: "Hockey",
          sortOrder: 7,
        },
        {
          countryCode: null,
          description: "Golf feeds.",
          iconKey: "sports",
          id: "golf",
          label: "Golf",
          sortOrder: 8,
        },
      ],
      feeds: [
        {
          aliases: [],
          categoryId: "archaeology",
          id: "archaeology-feed",
          label: "Archaeology Feed",
          source: "archaeology.example",
          sortOrder: 0,
          url: "https://archaeology.example/feed.xml",
        },
        {
          aliases: [],
          categoryId: "geology",
          id: "geology-feed",
          label: "Geology Feed",
          source: "geology.example",
          sortOrder: 1,
          url: "https://geology.example/feed.xml",
        },
        {
          aliases: [],
          categoryId: "mma",
          id: "mma-feed",
          label: "MMA Feed",
          source: "mma.example",
          sortOrder: 2,
          url: "https://mma.example/feed.xml",
        },
        {
          aliases: [],
          categoryId: "boxing",
          id: "boxing-feed",
          label: "Boxing Feed",
          source: "boxing.example",
          sortOrder: 3,
          url: "https://boxing.example/feed.xml",
        },
        {
          aliases: [],
          categoryId: "american-football",
          id: "american-football-feed",
          label: "American Football Feed",
          source: "american-football.example",
          sortOrder: 4,
          url: "https://american-football.example/feed.xml",
        },
        {
          aliases: [],
          categoryId: "basketball",
          id: "basketball-feed",
          label: "Basketball Feed",
          source: "basketball.example",
          sortOrder: 5,
          url: "https://basketball.example/feed.xml",
        },
        {
          aliases: [],
          categoryId: "baseball",
          id: "baseball-feed",
          label: "Baseball Feed",
          source: "baseball.example",
          sortOrder: 6,
          url: "https://baseball.example/feed.xml",
        },
        {
          aliases: [],
          categoryId: "hockey",
          id: "hockey-feed",
          label: "Hockey Feed",
          source: "hockey.example",
          sortOrder: 7,
          url: "https://hockey.example/feed.xml",
        },
        {
          aliases: [],
          categoryId: "golf",
          id: "golf-feed",
          label: "Golf Feed",
          source: "golf.example",
          sortOrder: 8,
          url: "https://golf.example/feed.xml",
        },
      ],
    })

    expect(groups.map((group) => group.label)).toEqual([
      "American Football",
      "Archaeology",
      "Baseball",
      "Basketball",
      "Boxing",
      "Geology",
      "Golf",
      "Hockey",
      "MMA",
    ])
    expect(groups).toContainEqual(
      expect.objectContaining({
        description:
          "Archaeology news, digs, artifacts, ancient history, cultural heritage, and discoveries.",
        feedCount: 1,
        iconKey: "science",
        id: "archaeology",
        label: "Archaeology",
      })
    )
    expect(groups).toContainEqual(
      expect.objectContaining({
        description:
          "NFL and American football coverage, trades, analysis, teams, and league news.",
        feedCount: 1,
        iconKey: "sports",
        id: "american-football",
        label: "American Football",
      })
    )
    expect(groups).toContainEqual(
      expect.objectContaining({
        description:
          "Mixed martial arts news, UFC coverage, fight analysis, rankings, and combat-sports commentary.",
        feedCount: 1,
        iconKey: "sports",
        id: "mma",
        label: "MMA",
      })
    )
  })

  it("sorts topic groups alphabetically by their display labels", () => {
    const groups = createDiscoverInterestGroups({
      categories: [
        {
          countryCode: null,
          description: "Technology feeds.",
          iconKey: "tech",
          id: "tech",
          label: "Tech",
          sortOrder: 0,
        },
        {
          countryCode: null,
          description: "General feeds.",
          iconKey: "general",
          id: "general",
          label: "General",
          sortOrder: 1,
        },
        {
          countryCode: null,
          description: "AI feeds.",
          iconKey: "ai",
          id: "ai",
          label: "AI",
          sortOrder: 2,
        },
        {
          countryCode: null,
          description: "Business feeds.",
          iconKey: "business",
          id: "business",
          label: "Business",
          sortOrder: 3,
        },
        {
          countryCode: null,
          description: "Marketing feeds.",
          iconKey: "marketing",
          id: "marketing",
          label: "Marketing",
          sortOrder: 4,
        },
        {
          countryCode: null,
          description: "Comics feeds.",
          iconKey: "comics",
          id: "comics",
          label: "Comics",
          sortOrder: 5,
        },
        {
          countryCode: null,
          description: "Food feeds.",
          iconKey: "food",
          id: "food",
          label: "Food",
          sortOrder: 6,
        },
        {
          countryCode: null,
          description: "Design feeds.",
          iconKey: "design",
          id: "design",
          label: "Design",
          sortOrder: 7,
        },
        {
          countryCode: null,
          description: "Torrenting feeds.",
          iconKey: "torrenting",
          id: "torrenting",
          label: "Torrenting",
          sortOrder: 8,
        },
        {
          countryCode: null,
          description: "Advertising feeds.",
          iconKey: "advertising",
          id: "advertising",
          label: "Advertising",
          sortOrder: 9,
        },
        {
          countryCode: null,
          description: "Biopharma feeds.",
          iconKey: "biopharma",
          id: "biopharma",
          label: "Biopharma",
          sortOrder: 10,
        },
        {
          countryCode: null,
          description: "Cybersecurity feeds.",
          iconKey: "cybersecurity",
          id: "cybersecurity",
          label: "Cybersecurity",
          sortOrder: 11,
        },
        {
          countryCode: null,
          description: "Energy feeds.",
          iconKey: "energy",
          id: "energy",
          label: "Energy",
          sortOrder: 12,
        },
        {
          countryCode: null,
          description: "Healthcare feeds.",
          iconKey: "healthcare",
          id: "healthcare",
          label: "Healthcare",
          sortOrder: 13,
        },
        {
          countryCode: null,
          description: "Real estate feeds.",
          iconKey: "real-estate",
          id: "real-estate",
          label: "Real Estate",
          sortOrder: 14,
        },
        {
          countryCode: null,
          description: "Retail feeds.",
          iconKey: "retail",
          id: "retail",
          label: "Retail",
          sortOrder: 15,
        },
        {
          countryCode: null,
          description: "Travel and hospitality feeds.",
          iconKey: "travel-hospitality",
          id: "travel-hospitality",
          label: "Travel & Hospitality",
          sortOrder: 16,
        },
      ],
      feeds: [],
    })

    expect(groups.map((group) => group.label)).toEqual([
      "Advertising",
      "AI",
      "Biopharma",
      "Business",
      "Comics",
      "Cybersecurity",
      "Design",
      "Energy",
      "Food",
      "General",
      "Healthcare",
      "Marketing",
      "Real Estate",
      "Retail",
      "Tech",
      "Torrenting",
      "Travel & Hospitality",
    ])
  })
})

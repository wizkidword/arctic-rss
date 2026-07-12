import {
  getCategoryCountryCode,
  getDiscoverDirectory,
  type DiscoverDirectory,
  type DiscoverDirectoryCategory,
  type DiscoverDirectoryFeed,
} from "./discover-directory"
import type { DiscoverCategoryIconKey } from "./discover-category-icons"

const knownInterestIds = [
  "advertising",
  "ai",
  "aliens",
  "american-football",
  "archaeology",
  "baseball",
  "basketball",
  "biopharma",
  "boxing",
  "business",
  "comics",
  "content-marketing",
  "crafts",
  "creativity",
  "culture",
  "cybersecurity",
  "data-science",
  "design",
  "economics",
  "energy",
  "entertainment",
  "entrepreneurship",
  "food",
  "gaming",
  "general",
  "geology",
  "golf",
  "health",
  "healthcare",
  "hockey",
  "leadership",
  "management",
  "marketing",
  "mma",
  "paranormal",
  "photography",
  "politics",
  "reddit",
  "real-estate",
  "retail",
  "science",
  "seo",
  "sports",
  "tech",
  "torrenting",
  "travel-hospitality",
  "world",
  "writing",
] as const

const topicDescriptions: Record<string, string> = {
  advertising: "Advertising, media buying, creative campaigns, ad tech, and brand marketing coverage.",
  ai: "Artificial intelligence news, research, models, tools, policy, and machine-learning coverage.",
  aliens: "UFOs, UAP, extraterrestrial life, astrobiology, space signals, and alien-culture coverage.",
  "american-football": "NFL and American football coverage, trades, analysis, teams, and league news.",
  archaeology: "Archaeology news, digs, artifacts, ancient history, cultural heritage, and discoveries.",
  baseball: "Baseball news, MLB coverage, analytics, trades, prospects, and analysis.",
  basketball: "Basketball news, NBA coverage, trades, analysis, and league reporting.",
  biopharma: "Biotech, pharmaceutical research, drug development, and life-sciences industry coverage.",
  boxing: "Boxing news, fight previews, results, rankings, and analysis.",
  business: "Markets, companies, economy, and workplace reporting.",
  comics: "Webcomics, comic culture, industry news, and graphic storytelling.",
  "content-marketing": "Content strategy, editorial marketing, copywriting, audience growth, and brand publishing.",
  crafts: "Craft projects, DIY making, paper goods, sewing, crochet, home projects, and handmade ideas.",
  creativity: "Creative work, inspiration, visual culture, artists, ideas, and creative practice.",
  culture: "Arts, media, books, ideas, criticism, cultural reporting, and public life.",
  cybersecurity: "Threat intelligence, breaches, vulnerabilities, security research, and defensive practice.",
  "data-science": "Data science, machine learning, analytics, statistics, and applied research.",
  design: "Product design, UX, visual design, architecture, and creative culture.",
  economics: "Economics research, policy, macro trends, markets, labor, and public institutions.",
  energy: "Power, renewables, utilities, oil and gas, climate tech, and energy markets.",
  entertainment: "Film, television, music, celebrity, and culture coverage.",
  entrepreneurship: "Founder stories, startup advice, small business tactics, and entrepreneurship coverage.",
  food: "Recipes, cooking, restaurants, baking, and food culture.",
  gaming: "Video game news, reviews, deals, and industry coverage.",
  general: "Headlines and reporting from national and regional outlets.",
  geology: "Geology, earth science, geoscience research, earthquakes, volcanoes, minerals, and climate.",
  golf: "Golf news, tours, equipment, instruction, majors, and player coverage.",
  health: "Health, wellness, medicine, and public health reporting.",
  healthcare: "Healthcare business, hospitals, policy, digital health, and care delivery.",
  hockey: "Hockey news, NHL coverage, trades, analysis, prospects, and league reporting.",
  leadership: "Leadership practice, executive coaching, teams, culture, and organizational decision-making.",
  management: "Management practice, operations, workplace advice, strategy, and team effectiveness.",
  marketing: "Marketing strategy, SEO, social media, content, and growth coverage.",
  mma: "Mixed martial arts news, UFC coverage, fight analysis, rankings, and combat-sports commentary.",
  paranormal: "Ghosts, hauntings, cryptids, folklore, unexplained phenomena, and skeptical investigation.",
  photography: "Photography news, camera gear, editing, technique, and visual storytelling.",
  politics: "Elections, policy, government, and political analysis.",
  reddit: "Popular subreddit feeds from Reddit communities.",
  "real-estate": "Housing markets, property technology, mortgage, commercial, and residential real estate.",
  retail: "Retail operations, ecommerce, grocery, merchandising, and consumer commerce.",
  science: "Science, space, research, environment, and discovery coverage.",
  seo: "Search engine optimization tactics, search product updates, analytics, and organic growth.",
  sports: "Sports headlines, analysis, scores, and commentary.",
  tech: "Technology news, startups, gadgets, platforms, and security.",
  torrenting: "BitTorrent news, open-source client releases, and legal open-download sources.",
  "travel-hospitality": "Travel, hotels, airlines, tourism, hospitality operations, and guest experience.",
  world: "International headlines and reporting from global outlets.",
  writing: "Writing craft, publishing, books, literary culture, editing, and author advice.",
}

const topicLabels: Record<string, string> = {
  ai: "AI",
  mma: "MMA",
  seo: "SEO",
  "travel-hospitality": "Travel & Hospitality",
}

export type DiscoverInterestGroup = {
  readonly categoryCount: number
  readonly categoryIds: readonly string[]
  readonly description: string
  readonly feedCount: number
  readonly iconKey: DiscoverCategoryIconKey
  readonly id: string
  readonly label: string
  readonly sortOrder: number
}

export type DiscoverInterestNavigationItem = Pick<
  DiscoverInterestGroup,
  "feedCount" | "id" | "label"
>

export function createDiscoverInterestGroups(directory: DiscoverDirectory) {
  const categoriesById = new Map(
    directory.categories.map((category) => [category.id, category])
  )
  const categoriesByInterest = new Map<string, DiscoverDirectoryCategory[]>()
  const feedCountsByInterest = new Map<string, number>()

  for (const category of directory.categories) {
    const interestId = getDiscoverInterestId(category)
    const categories = categoriesByInterest.get(interestId) ?? []

    categories.push(category)
    categoriesByInterest.set(interestId, categories)
  }

  for (const feed of directory.feeds) {
    const interestId = getDiscoverInterestId(
      categoriesById.get(feed.categoryId) ?? feed.categoryId
    )

    feedCountsByInterest.set(
      interestId,
      (feedCountsByInterest.get(interestId) ?? 0) + 1
    )
  }

  return [...categoriesByInterest.entries()]
    .map(([id, categories]) => {
      const firstCategory = categories[0]

      return {
        categoryCount: categories.length,
        categoryIds: categories.map((category) => category.id),
        description: getDiscoverInterestDescription(id, firstCategory),
        feedCount: feedCountsByInterest.get(id) ?? 0,
        iconKey: firstCategory?.iconKey ?? "general",
        id,
        label: getDiscoverInterestLabel(firstCategory, id),
        sortOrder: firstCategory?.sortOrder ?? Number.MAX_SAFE_INTEGER,
      } satisfies DiscoverInterestGroup
    })
    .sort(
      (left, right) =>
        left.label.localeCompare(right.label, undefined, {
          sensitivity: "base",
        }) ||
        left.sortOrder - right.sortOrder ||
        left.id.localeCompare(right.id)
    )
}

export async function listDiscoverInterestNavigation() {
  const directory = await getDiscoverDirectory()

  return createDiscoverInterestGroups(directory).map((interest) => ({
    feedCount: interest.feedCount,
    id: interest.id,
    label: interest.label,
  }))
}

export function listDiscoverInterestFeeds({
  categories = [],
  feeds,
  interestId,
}: {
  categories?: readonly DiscoverDirectoryCategory[]
  feeds: readonly DiscoverDirectoryFeed[]
  interestId: string
}) {
  const categoriesById = new Map(
    categories.map((category) => [category.id, category])
  )
  const normalizedInterestId = normalizeInterestId(interestId)

  return feeds
    .filter(
      (feed) =>
        getDiscoverInterestId(categoriesById.get(feed.categoryId) ?? feed.categoryId) ===
        normalizedInterestId
    )
}

export function getDiscoverInterestId(
  category: string | Pick<DiscoverDirectoryCategory, "countryCode" | "id" | "label">
) {
  if (typeof category !== "string" && getCategoryCountryCode(category)) {
    return getCountryBackedInterestId(category)
  }

  const categoryId = typeof category === "string" ? category : category.id
  const normalizedCategoryId = normalizeInterestId(categoryId)
  const prefixedMatch = /^(?:[a-z]{2}|opml)-(.+)$/.exec(normalizedCategoryId)

  return prefixedMatch?.[1] ?? normalizedCategoryId
}

function getCountryBackedInterestId(
  category: Pick<DiscoverDirectoryCategory, "countryCode" | "id" | "label">
) {
  const normalizedCategoryId = normalizeInterestId(category.id)
  const normalizedCountryCode = normalizeInterestId(
    getCategoryCountryCode(category) ?? ""
  )

  if (
    normalizedCountryCode &&
    normalizedCategoryId.startsWith(`${normalizedCountryCode}-`)
  ) {
    const suffix = normalizedCategoryId.slice(normalizedCountryCode.length + 1)

    return findKnownTopicId(suffix) ?? "general"
  }

  const knownTopic =
    findKnownTopicId(normalizedCategoryId) ??
    findKnownTopicId(normalizeInterestId(category.label))

  return knownTopic ?? "general"
}

function findKnownTopicId(value: string) {
  return (
    knownInterestIds.find(
      (topic) => value === topic || value.endsWith(`-${topic}`)
    ) ?? null
  )
}

function getDiscoverInterestDescription(
  interestId: string,
  category: DiscoverDirectoryCategory | undefined
) {
  return topicDescriptions[interestId] ?? category?.description ?? ""
}

function getDiscoverInterestLabel(
  category: DiscoverDirectoryCategory | undefined,
  fallbackId: string
) {
  if (topicLabels[fallbackId]) {
    return topicLabels[fallbackId]
  }

  if (topicDescriptions[fallbackId] || category?.countryCode) {
    return titleizeInterestId(fallbackId)
  }

  const label = stripOpmlLabelPrefix(category?.label ?? "")

  return label || titleizeInterestId(fallbackId)
}

function stripOpmlLabelPrefix(value: string) {
  return value.replace(/^OPML\s+/i, "").trim()
}

function normalizeInterestId(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-")
}

function titleizeInterestId(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ")
}

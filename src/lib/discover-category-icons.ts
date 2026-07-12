export const discoverCategoryIconOptions = [
  {
    key: "general",
    label: "General",
  },
  {
    key: "world",
    label: "World",
  },
  {
    key: "politics",
    label: "Politics",
  },
  {
    key: "business",
    label: "Business",
  },
  {
    key: "health",
    label: "Health",
  },
  {
    key: "science",
    label: "Science",
  },
  {
    key: "ai",
    label: "AI",
  },
  {
    key: "aliens",
    label: "Aliens",
  },
  {
    key: "sports",
    label: "Sports",
  },
  {
    key: "tech",
    label: "Tech",
  },
  {
    key: "entertainment",
    label: "Entertainment",
  },
  {
    key: "gaming",
    label: "Gaming",
  },
  {
    key: "audio",
    label: "Audio",
  },
  {
    key: "reddit",
    label: "Reddit",
  },
  {
    key: "android",
    label: "Android",
  },
  {
    key: "android-development",
    label: "Android Development",
  },
  {
    key: "apple",
    label: "Apple",
  },
  {
    key: "architecture",
    label: "Architecture",
  },
  {
    key: "beauty",
    label: "Beauty",
  },
  {
    key: "books",
    label: "Books",
  },
  {
    key: "cars",
    label: "Cars",
  },
  {
    key: "advertising",
    label: "Advertising",
  },
  {
    key: "biopharma",
    label: "Biopharma",
  },
  {
    key: "cybersecurity",
    label: "Cybersecurity",
  },
  {
    key: "energy",
    label: "Energy",
  },
  {
    key: "healthcare",
    label: "Healthcare",
  },
  {
    key: "marketing",
    label: "Marketing",
  },
  {
    key: "comics",
    label: "Comics",
  },
  {
    key: "design",
    label: "Design",
  },
  {
    key: "cricket",
    label: "Cricket",
  },
  {
    key: "interior-design",
    label: "Interior Design",
  },
  {
    key: "diy",
    label: "DIY",
  },
  {
    key: "fashion",
    label: "Fashion",
  },
  {
    key: "food",
    label: "Food",
  },
  {
    key: "football",
    label: "Football",
  },
  {
    key: "funny",
    label: "Funny",
  },
  {
    key: "history",
    label: "History",
  },
  {
    key: "ios-development",
    label: "iOS Development",
  },
  {
    key: "movies",
    label: "Movies",
  },
  {
    key: "music",
    label: "Music",
  },
  {
    key: "personal-finance",
    label: "Personal Finance",
  },
  {
    key: "paranormal",
    label: "Paranormal",
  },
  {
    key: "photography",
    label: "Photography",
  },
  {
    key: "programming",
    label: "Programming",
  },
  {
    key: "space",
    label: "Space",
  },
  {
    key: "startups",
    label: "Startups",
  },
  {
    key: "television",
    label: "Television",
  },
  {
    key: "tennis",
    label: "Tennis",
  },
  {
    key: "travel",
    label: "Travel",
  },
  {
    key: "travel-hospitality",
    label: "Travel & Hospitality",
  },
  {
    key: "torrenting",
    label: "Torrenting",
  },
  {
    key: "ui-ux",
    label: "UI / UX",
  },
  {
    key: "real-estate",
    label: "Real Estate",
  },
  {
    key: "retail",
    label: "Retail",
  },
  {
    key: "web-development",
    label: "Web Development",
  },
] as const

export type DiscoverCategoryIconKey =
  (typeof discoverCategoryIconOptions)[number]["key"]

const discoverCategoryIconKeys = new Set<string>(
  discoverCategoryIconOptions.map((option) => option.key)
)

export function isDiscoverCategoryIconKey(
  value: unknown
): value is DiscoverCategoryIconKey {
  return typeof value === "string" && discoverCategoryIconKeys.has(value)
}

const defaultIconRules: Array<{
  iconKey: DiscoverCategoryIconKey
  phrases: readonly string[]
}> = [
  {
    iconKey: "ai",
    phrases: [
      "ai",
      "artificial intelligence",
      "generative ai",
      "machine learning",
      "deep learning",
      "llm",
      "llms",
    ],
  },
  {
    iconKey: "aliens",
    phrases: [
      "aliens",
      "alien",
      "ufo",
      "ufos",
      "uap",
      "uaps",
      "extraterrestrial",
      "extraterrestrials",
    ],
  },
  {
    iconKey: "paranormal",
    phrases: [
      "paranormal",
      "ghost",
      "ghosts",
      "haunting",
      "hauntings",
      "cryptid",
      "cryptids",
      "fortean",
    ],
  },
  {
    iconKey: "android-development",
    phrases: [
      "android development",
      "android develpment",
      "android dev",
      "android programming",
    ],
  },
  {
    iconKey: "ios-development",
    phrases: [
      "ios development",
      "ios dev",
      "iphone development",
      "ipad development",
      "swift development",
    ],
  },
  {
    iconKey: "web-development",
    phrases: [
      "web development",
      "web dev",
      "front end",
      "front-end",
      "frontend",
    ],
  },
  {
    iconKey: "ui-ux",
    phrases: [
      "ui ux",
      "ux ui",
      "user experience",
      "interface design",
      "product design",
    ],
  },
  {
    iconKey: "interior-design",
    phrases: ["interior design", "home design"],
  },
  {
    iconKey: "advertising",
    phrases: [
      "advertising",
      "ad tech",
      "adtech",
      "media buying",
      "campaigns",
    ],
  },
  {
    iconKey: "marketing",
    phrases: [
      "marketing",
      "seo",
      "social media marketing",
      "content marketing",
      "growth marketing",
    ],
  },
  {
    iconKey: "comics",
    phrases: ["comics", "comic", "webcomics", "webcomic", "graphic novels"],
  },
  {
    iconKey: "design",
    phrases: ["design", "visual design", "creative culture", "creativity", "creative"],
  },
  {
    iconKey: "biopharma",
    phrases: [
      "biopharma",
      "biotech",
      "pharmaceutical",
      "pharmaceuticals",
      "life sciences",
      "drug development",
    ],
  },
  {
    iconKey: "cybersecurity",
    phrases: [
      "cybersecurity",
      "cyber security",
      "infosec",
      "information security",
      "threat intelligence",
    ],
  },
  {
    iconKey: "energy",
    phrases: ["energy", "utilities", "renewables", "oil and gas", "climate tech"],
  },
  {
    iconKey: "healthcare",
    phrases: ["healthcare", "health care", "hospitals", "digital health"],
  },
  {
    iconKey: "real-estate",
    phrases: [
      "real estate",
      "housing market",
      "housing markets",
      "mortgage",
      "property technology",
      "proptech",
    ],
  },
  {
    iconKey: "retail",
    phrases: ["retail", "ecommerce", "e commerce", "grocery", "merchandising"],
  },
  {
    iconKey: "travel-hospitality",
    phrases: [
      "travel hospitality",
      "travel and hospitality",
      "hospitality",
      "hotels",
      "airlines",
      "tourism",
    ],
  },
  {
    iconKey: "personal-finance",
    phrases: ["personal finance", "finance", "investing", "money"],
  },
  {
    iconKey: "android",
    phrases: ["android", "cell phone", "smartphone", "mobile phone"],
  },
  {
    iconKey: "apple",
    phrases: ["apple company", "apple", "mac", "macintosh"],
  },
  {
    iconKey: "architecture",
    phrases: ["architecture", "architectural"],
  },
  {
    iconKey: "beauty",
    phrases: ["beauty", "makeup", "skincare", "cosmetics"],
  },
  {
    iconKey: "books",
    phrases: ["books", "book", "literature", "reading", "writing", "writers", "author"],
  },
  {
    iconKey: "cars",
    phrases: ["cars", "car", "autos", "auto", "automotive"],
  },
  {
    iconKey: "cricket",
    phrases: ["cricket"],
  },
  {
    iconKey: "diy",
    phrases: ["diy", "do it yourself", "maker", "makers", "crafts", "craft", "handmade"],
  },
  {
    iconKey: "fashion",
    phrases: ["fashion", "fasion", "style", "clothing"],
  },
  {
    iconKey: "food",
    phrases: ["food", "cooking", "recipes", "recipe", "restaurants"],
  },
  {
    iconKey: "football",
    phrases: ["football", "soccer"],
  },
  {
    iconKey: "funny",
    phrases: ["funny", "humor", "humour", "comedy", "memes"],
  },
  {
    iconKey: "history",
    phrases: ["history", "historical"],
  },
  {
    iconKey: "movies",
    phrases: ["movies", "movie", "film", "cinema"],
  },
  {
    iconKey: "music",
    phrases: ["music", "songs", "albums", "bands"],
  },
  {
    iconKey: "photography",
    phrases: ["photography", "photo", "photos", "camera"],
  },
  {
    iconKey: "programming",
    phrases: ["programming", "coding", "software development", "developers"],
  },
  {
    iconKey: "space",
    phrases: ["space", "astronomy", "nasa", "cosmos"],
  },
  {
    iconKey: "startups",
    phrases: [
      "startups",
      "start ups",
      "start up",
      "venture",
      "entrepreneurship",
      "entrepreneur",
      "founder",
      "founders",
    ],
  },
  {
    iconKey: "television",
    phrases: ["television", "tv"],
  },
  {
    iconKey: "tennis",
    phrases: ["tennis"],
  },
  {
    iconKey: "travel",
    phrases: ["travel", "tourism", "trips", "destinations"],
  },
  {
    iconKey: "torrenting",
    phrases: ["torrenting", "bittorrent", "torrent", "torrents", "p2p"],
  },
  {
    iconKey: "world",
    phrases: ["world", "global", "international"],
  },
  {
    iconKey: "politics",
    phrases: ["politics", "policy", "government", "election"],
  },
  {
    iconKey: "business",
    phrases: [
      "business economy",
      "business and economy",
      "business",
      "economy",
      "economics",
      "leadership",
      "management",
      "markets",
    ],
  },
  {
    iconKey: "health",
    phrases: ["health", "medicine", "wellness", "medical"],
  },
  {
    iconKey: "science",
    phrases: ["science", "research", "environment", "data science", "statistics"],
  },
  {
    iconKey: "sports",
    phrases: ["sports", "sport", "scores"],
  },
  {
    iconKey: "tech",
    phrases: ["tech", "technology", "gadgets", "platforms", "security"],
  },
  {
    iconKey: "entertainment",
    phrases: ["entertainment", "celebrity", "culture"],
  },
  {
    iconKey: "gaming",
    phrases: ["gaming", "games", "video games", "game"],
  },
  {
    iconKey: "audio",
    phrases: ["audio", "podcast", "podcasts", "radio"],
  },
  {
    iconKey: "reddit",
    phrases: ["reddit", "subreddit", "subreddits"],
  },
  {
    iconKey: "general",
    phrases: ["general", "news", "headlines"],
  },
]

export function getDefaultDiscoverCategoryIconKey(
  categoryId: string,
  categoryLabel = ""
): DiscoverCategoryIconKey {
  const searchText = normalizeCategoryText(`${categoryId} ${categoryLabel}`)

  for (const rule of defaultIconRules) {
    if (rule.phrases.some((phrase) => containsPhrase(searchText, phrase))) {
      return rule.iconKey
    }
  }

  const candidate = normalizeCategoryText(
    categoryId.replace(/^(?:[a-z]{2}|opml)-/, "").split("-")[0] ?? ""
  )

  return isDiscoverCategoryIconKey(candidate) ? candidate : "general"
}

function normalizeCategoryText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function containsPhrase(searchText: string, phrase: string) {
  const normalizedPhrase = normalizeCategoryText(phrase)

  if (!normalizedPhrase) {
    return false
  }

  return new RegExp(
    `(?:^|\\s)${escapeRegex(normalizedPhrase).replace(/\s+/g, "\\s+")}(?:\\s|$)`
  ).test(searchText)
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

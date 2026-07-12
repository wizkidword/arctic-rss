import { getPrisma } from "./db"
import {
  feedDirectoryCategories,
  feedDirectoryFeeds,
  getFeedDirectoryFeed,
  type FeedDirectoryCategory,
  type FeedDirectoryFeed,
} from "./feed-directory"
import {
  getRedditDirectoryFeed,
  redditDirectoryCategory,
  redditDirectoryFeeds,
} from "./reddit-directory"
import {
  getDefaultDiscoverCategoryIconKey,
  isDiscoverCategoryIconKey,
  type DiscoverCategoryIconKey,
} from "./discover-category-icons"

const staticNationCodes = ["us", "ca", "in", "gb", "au", "bd"] as const

const countryCodesByExactLabel = new Map([
  ["australia", "au"],
  ["bangladesh", "bd"],
  ["canada", "ca"],
  ["great britain", "gb"],
  ["india", "in"],
  ["u.k.", "gb"],
  ["uk", "gb"],
  ["united kingdom", "gb"],
  ["united states", "us"],
  ["united states of america", "us"],
  ["u.s.", "us"],
  ["usa", "us"],
])

export type DiscoverDirectoryCategory = FeedDirectoryCategory & {
  readonly countryCode: string | null
  readonly dynamic?: boolean
  readonly iconKey: DiscoverCategoryIconKey
  readonly sortOrder: number
}

type DiscoverDirectoryCategoryInput = Omit<
  DiscoverDirectoryCategory,
  "iconKey"
> & {
  readonly iconKey?: DiscoverCategoryIconKey
}

export type DiscoverDirectoryFeed = FeedDirectoryFeed & {
  readonly aliases?: readonly string[]
  readonly dynamic?: boolean
  readonly sortOrder: number
}

export type DiscoverDirectory = {
  readonly categories: readonly DiscoverDirectoryCategory[]
  readonly feeds: readonly DiscoverDirectoryFeed[]
}

export type DynamicDiscoverDirectory = {
  readonly categoryCustomizations?: readonly DiscoverCategoryCustomization[]
  readonly dynamicCategories?: readonly DiscoverDirectoryCategoryInput[]
  readonly dynamicFeeds?: readonly DiscoverDirectoryFeed[]
}

export type DiscoverCategoryCustomization = {
  readonly categoryId: string
  readonly description?: string | null
  readonly iconKey?: string | null
}

type DiscoverCategoryRecord = {
  countryCode: string | null
  description: string
  feeds: DiscoverFeedRecord[]
  label: string
  slug: string
  sortOrder: number
}

type DiscoverFeedRecord = {
  aliases: string[]
  label: string
  slug: string
  source: string
  sortOrder: number
  url: string
}

type DiscoverCategoryCustomizationRecord = {
  categorySlug: string
  description: string | null
  iconKey: string | null
}

type DiscoverDirectoryStore = {
  discoverCategory: {
    findMany(args: {
      include: {
        feeds: {
          orderBy: Array<{ sortOrder: "asc" } | { label: "asc" }>
        }
      }
      orderBy: Array<{ sortOrder: "asc" } | { label: "asc" }>
    }): Promise<DiscoverCategoryRecord[]>
  }
  discoverCategoryCustomization: {
    findMany(args: {
      orderBy: {
        categorySlug: "asc"
      }
      select: {
        categorySlug: true
        description: true
        iconKey: true
      }
    }): Promise<DiscoverCategoryCustomizationRecord[]>
  }
  discoverFeed: {
    findUnique(args: {
      select: {
        aliases: true
        category: {
          select: {
            slug: true
          }
        }
        label: true
        slug: true
        source: true
        sortOrder: true
        url: true
      }
      where: {
        slug: string
      }
    }): Promise<
      | (DiscoverFeedRecord & {
          category: {
            slug: string
          }
        })
      | null
    >
  }
}

export function mergeDiscoverDirectory({
  categoryCustomizations = [],
  dynamicCategories = [],
  dynamicFeeds = [],
}: DynamicDiscoverDirectory = {}): DiscoverDirectory {
  const staticCategories = [...feedDirectoryCategories, redditDirectoryCategory].map(
    (category, index) => ({
      ...category,
      countryCode: inferStaticCountryCode(category.id),
      dynamic: false,
      iconKey: getDefaultDiscoverCategoryIconKey(category.id, category.label),
      sortOrder: index,
    })
  )
  const staticCategoryIds = new Set(
    staticCategories.map((category) => category.id)
  )
  const staticFeeds = [...feedDirectoryFeeds, ...redditDirectoryFeeds].map((feed, index) => ({
    ...feed,
    dynamic: false,
    sortOrder: index,
  }))

  return {
    categories: applyCategoryCustomizations(
      [
        ...staticCategories,
        ...[...dynamicCategories]
          .sort(compareDirectoryItems)
          .filter((category) => !staticCategoryIds.has(category.id))
          .map((category) => ({
            ...category,
            iconKey:
              category.iconKey ??
              getDefaultDiscoverCategoryIconKey(category.id, category.label),
          })),
      ],
      categoryCustomizations
    ),
    feeds: [...staticFeeds, ...[...dynamicFeeds].sort(compareDirectoryItems)],
  }
}

export async function getDiscoverDirectory() {
  return mergeDiscoverDirectory(await listDynamicDiscoverDirectory())
}

export async function getDiscoverDirectoryFeed(feedId: string) {
  const staticFeed =
    getFeedDirectoryFeed(feedId) ?? getRedditDirectoryFeed(feedId)

  if (staticFeed) {
    return staticFeed
  }

  const feed = await getDiscoverDirectoryStore().discoverFeed.findUnique({
    select: {
      aliases: true,
      category: {
        select: {
          slug: true,
        },
      },
      label: true,
      slug: true,
      source: true,
      sortOrder: true,
      url: true,
    },
    where: {
      slug: feedId,
    },
  })

  if (!feed) {
    return undefined
  }

  return {
    aliases: feed.aliases,
    categoryId: feed.category.slug,
    dynamic: true,
    id: feed.slug,
    label: feed.label,
    sortOrder: feed.sortOrder,
    source: feed.source,
    url: feed.url,
  } satisfies DiscoverDirectoryFeed
}

export async function listDynamicDiscoverDirectory(
  store = getDiscoverDirectoryStore()
): Promise<Required<DynamicDiscoverDirectory>> {
  const [categories, categoryCustomizations] = await Promise.all([
    store.discoverCategory.findMany({
      include: {
        feeds: {
          orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
        },
      },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    }),
    store.discoverCategoryCustomization.findMany({
      orderBy: {
        categorySlug: "asc",
      },
      select: {
        categorySlug: true,
        description: true,
        iconKey: true,
      },
    }),
  ])

  return {
    categoryCustomizations: categoryCustomizations.map((customization) => ({
      categoryId: customization.categorySlug,
      description: customization.description,
      iconKey: customization.iconKey,
    })),
    dynamicCategories: categories.map((category) => ({
      countryCode: normalizeCountryCode(category.countryCode),
      description: category.description,
      dynamic: true,
      iconKey: getDefaultDiscoverCategoryIconKey(category.slug, category.label),
      id: category.slug,
      label: category.label,
      sortOrder: category.sortOrder,
    })),
    dynamicFeeds: categories.flatMap((category) =>
      category.feeds.map((feed) => ({
        aliases: feed.aliases,
        categoryId: category.slug,
        dynamic: true,
        id: feed.slug,
        label: feed.label,
        sortOrder: feed.sortOrder,
        source: feed.source,
        url: feed.url,
      }))
    ),
  }
}

export function getNationShortcuts(
  categories: readonly (
    Pick<DiscoverDirectoryCategory, "countryCode" | "id"> &
      Partial<Pick<DiscoverDirectoryCategory, "label">>
  )[]
) {
  const countryCodes = new Set<string>()

  for (const category of categories) {
    const countryCode = getCategoryCountryCode(category)

    if (countryCode) {
      countryCodes.add(countryCode)
    }
  }

  const staticShortcuts = staticNationCodes.filter((country) =>
    countryCodes.has(country)
  )
  const dynamicShortcuts = [...countryCodes]
    .filter((country) => !staticNationCodes.includes(country as never))
    .sort()

  return [...staticShortcuts, ...dynamicShortcuts].map((country) => ({
    id: country,
    label: country.toUpperCase(),
  }))
}

export function getCategoryCountryCode(
  category: Pick<DiscoverDirectoryCategory, "countryCode" | "id"> &
    Partial<Pick<DiscoverDirectoryCategory, "label">>
) {
  return (
    normalizeCountryCode(category.countryCode) ??
    inferStaticCountryCode(category.id) ??
    inferCountryCodeFromLabel(category.label)
  )
}

function applyCategoryCustomizations(
  categories: readonly DiscoverDirectoryCategory[],
  categoryCustomizations: readonly DiscoverCategoryCustomization[]
) {
  const customizationsByCategoryId = new Map(
    categoryCustomizations.map((customization) => [
      customization.categoryId,
      customization,
    ])
  )

  return categories.map((category) => {
    const customization = customizationsByCategoryId.get(category.id)
    const description = customization?.description?.trim()
    const iconKey = customization?.iconKey

    return {
      ...category,
      description: description || category.description,
      iconKey: isDiscoverCategoryIconKey(iconKey) ? iconKey : category.iconKey,
    }
  })
}

function inferStaticCountryCode(categoryId: string) {
  return (
    staticNationCodes.find((country) => categoryId.startsWith(`${country}-`)) ??
    /^([a-z]{2})-/.exec(categoryId)?.[1] ??
    null
  )
}

function inferCountryCodeFromLabel(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase().replace(/\s+/g, " ")

  return normalized ? countryCodesByExactLabel.get(normalized) ?? null : null
}

function normalizeCountryCode(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase()

  return normalized && /^[a-z]{2}$/.test(normalized) ? normalized : null
}

function compareDirectoryItems(
  left: Pick<DiscoverDirectoryCategory, "label" | "sortOrder">,
  right: Pick<DiscoverDirectoryCategory, "label" | "sortOrder">
) {
  return left.sortOrder - right.sortOrder || left.label.localeCompare(right.label)
}

function getDiscoverDirectoryStore() {
  return getPrisma() as unknown as DiscoverDirectoryStore
}

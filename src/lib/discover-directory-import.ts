import { parseFeedXml } from "./feed-discovery"
import { getPrisma } from "./db"
import {
  OpmlError,
  parseOpmlSubscriptions,
  type OpmlSubscriptionEntry,
} from "./opml"
import { normalizeHttpUrl, safeFetchText } from "./url-safety"

const MAX_LABEL_LENGTH = 120
const MAX_DESCRIPTION_LENGTH = 300

export type DiscoverFeedVerification =
  | {
      aliases?: readonly string[]
      ok: true
      source?: string
      title?: string
      url: string
    }
  | {
      message: string
      ok: false
    }

export type DiscoverImportFeedPlan = {
  aliases: string[]
  categoryId: string
  id: string
  label: string
  sortOrder: number
  source: string
  url: string
}

export type DiscoverImportCategoryPlan = {
  countryCode: string | null
  description: string
  feeds: DiscoverImportFeedPlan[]
  id: string
  label: string
  sortOrder: number
}

export type DiscoverOpmlImportPlan = {
  categories: DiscoverImportCategoryPlan[]
  errors: DiscoverOpmlImportErrorEntry[]
  failedFeeds: number
  totalFeeds: number
}

export type DiscoverOpmlImportErrorEntry = {
  message: string
  title: string
  xmlUrl: string
}

export type DiscoverOpmlImportSummary = {
  categoriesCreated: number
  categoriesUpdated: number
  errors: DiscoverOpmlImportErrorEntry[]
  failedFeeds: number
  importedFeeds: number
  totalFeeds: number
}

type PlanDiscoverOpmlImportOptions = {
  categoryName?: string | null
  countryCode?: string | null
  description?: string | null
  fileName?: string | null
  opmlXml: string
  verifyFeed?: (entry: OpmlSubscriptionEntry) => Promise<DiscoverFeedVerification>
}

type ImportDiscoverOpmlOptions = Omit<
  PlanDiscoverOpmlImportOptions,
  "verifyFeed"
> & {
  adminUserId: string
  store?: DiscoverImportStore
  verifyFeed?: (entry: OpmlSubscriptionEntry) => Promise<DiscoverFeedVerification>
}

type DiscoverImportStore = {
  adminAuditLog: {
    create(args: {
      data: {
        action: string
        adminUserId: string
        metadata: Record<string, unknown>
        targetId: string | null
        targetType: string
      }
    }): Promise<unknown>
  }
  discoverCategory: {
    findUnique(args: {
      select: { id: true }
      where: { slug: string }
    }): Promise<{ id: string } | null>
    upsert(args: {
      create: {
        countryCode: string | null
        description: string
        label: string
        slug: string
        sortOrder: number
      }
      update: {
        countryCode: string | null
        description: string
        label: string
        sortOrder: number
      }
      where: { slug: string }
    }): Promise<{ id: string }>
  }
  discoverFeed: {
    upsert(args: {
      create: {
        aliases: string[]
        categoryId: string
        label: string
        slug: string
        sortOrder: number
        source: string
        url: string
      }
      update: {
        aliases: string[]
        categoryId: string
        label: string
        sortOrder: number
        source: string
        url: string
      }
      where: { slug: string }
    }): Promise<unknown>
  }
}

export class DiscoverOpmlImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DiscoverOpmlImportError"
  }
}

export async function planDiscoverOpmlImport({
  categoryName,
  countryCode,
  description,
  fileName,
  opmlXml,
  verifyFeed = verifyDiscoverFeed,
}: PlanDiscoverOpmlImportOptions): Promise<DiscoverOpmlImportPlan> {
  const entries = parseOpmlSubscriptions(opmlXml)
  const normalizedCountryCode = normalizeCountryCode(countryCode)
  const fallbackCategoryName =
    normalizeLabel(categoryName) ??
    normalizeLabel(opmlTitle(opmlXml)) ??
    normalizeLabel(fileNameStem(fileName)) ??
    "Imported Feeds"
  const entriesByCategory = groupEntriesByCategory(entries, fallbackCategoryName)
  const categoryIds = new Set<string>()
  const errors: DiscoverOpmlImportErrorEntry[] = []
  const categories: DiscoverImportCategoryPlan[] = []
  let categoryIndex = 0

  for (const [rawCategoryLabel, categoryEntries] of entriesByCategory) {
    const label = categoryLabel(rawCategoryLabel, normalizedCountryCode)
    const categoryId = uniqueSlug(
      categorySlug(label, normalizedCountryCode),
      categoryIds
    )
    const feedIds = new Set<string>()
    const feeds: DiscoverImportFeedPlan[] = []

    for (const entry of categoryEntries) {
      const verification = await verifyFeed(entry)

      if (!verification.ok) {
        errors.push({
          message: verification.message,
          title: entry.title,
          xmlUrl: entry.xmlUrl,
        })
        continue
      }

      const feedLabel = normalizeLabel(verification.title) ?? entry.title
      const feedUrl = verification.url
      const aliases = uniqueAliases([
        ...(verification.aliases ?? []),
        entry.xmlUrl,
      ], feedUrl)
      const source = normalizeLabel(verification.source) ?? sourceFromUrl(feedUrl)
      const feedId = uniqueSlug(`${categoryId}-${slugify(feedLabel)}`, feedIds)

      feeds.push({
        aliases,
        categoryId,
        id: feedId,
        label: feedLabel.slice(0, MAX_LABEL_LENGTH),
        sortOrder: feeds.length,
        source,
        url: feedUrl,
      })
    }

    if (feeds.length) {
      categories.push({
        countryCode: normalizedCountryCode,
        description: categoryDescription(label, description),
        feeds,
        id: categoryId,
        label,
        sortOrder: categoryIndex,
      })
      categoryIndex += 1
    }
  }

  return {
    categories,
    errors,
    failedFeeds: errors.length,
    totalFeeds: entries.length,
  }
}

export async function importDiscoverOpml({
  adminUserId,
  store = getDiscoverImportStore(),
  verifyFeed,
  ...options
}: ImportDiscoverOpmlOptions): Promise<DiscoverOpmlImportSummary> {
  const plan = await planDiscoverOpmlImport({
    ...options,
    verifyFeed,
  })

  if (!plan.categories.length) {
    throw new DiscoverOpmlImportError(
      "No verified feeds were found in that OPML file."
    )
  }

  let categoriesCreated = 0
  let categoriesUpdated = 0
  let importedFeeds = 0

  for (const category of plan.categories) {
    const existingCategory = await store.discoverCategory.findUnique({
      select: { id: true },
      where: { slug: category.id },
    })
    const persistedCategory = await store.discoverCategory.upsert({
      create: {
        countryCode: category.countryCode,
        description: category.description,
        label: category.label,
        slug: category.id,
        sortOrder: category.sortOrder,
      },
      update: {
        countryCode: category.countryCode,
        description: category.description,
        label: category.label,
        sortOrder: category.sortOrder,
      },
      where: { slug: category.id },
    })

    if (existingCategory) {
      categoriesUpdated += 1
    } else {
      categoriesCreated += 1
    }

    for (const feed of category.feeds) {
      await store.discoverFeed.upsert({
        create: {
          aliases: feed.aliases,
          categoryId: persistedCategory.id,
          label: feed.label,
          slug: feed.id,
          sortOrder: feed.sortOrder,
          source: feed.source,
          url: feed.url,
        },
        update: {
          aliases: feed.aliases,
          categoryId: persistedCategory.id,
          label: feed.label,
          sortOrder: feed.sortOrder,
          source: feed.source,
          url: feed.url,
        },
        where: { slug: feed.id },
      })
      importedFeeds += 1
    }
  }

  const summary = {
    categoriesCreated,
    categoriesUpdated,
    errors: plan.errors,
    failedFeeds: plan.failedFeeds,
    importedFeeds,
    totalFeeds: plan.totalFeeds,
  }

  await store.adminAuditLog.create({
    data: {
      action: "DISCOVER_OPML_IMPORT",
      adminUserId,
      metadata: {
        categoryIds: plan.categories.map((category) => category.id),
        errors: plan.errors,
        failedFeeds: plan.failedFeeds,
        importedFeeds,
        totalFeeds: plan.totalFeeds,
      },
      targetId: null,
      targetType: "DiscoverCategory",
    },
  })

  return summary
}

export async function verifyDiscoverFeed(
  entry: OpmlSubscriptionEntry
): Promise<DiscoverFeedVerification> {
  try {
    const response = await safeFetchText(normalizeHttpUrl(entry.xmlUrl), {
      maxBytes: 2 * 1024 * 1024,
      timeoutMs: 12_000,
    })
    const metadata = parseFeedXml(response.text, response.url.href)

    return {
      ok: true,
      source: sourceFromUrl(metadata.siteUrl ?? response.url.href),
      title: metadata.title,
      url: response.url.href,
    }
  } catch (error) {
    return {
      message: errorMessage(error),
      ok: false,
    }
  }
}

function groupEntriesByCategory(
  entries: OpmlSubscriptionEntry[],
  fallbackCategoryName: string
) {
  const groups = new Map<string, OpmlSubscriptionEntry[]>()

  for (const entry of entries) {
    const category = normalizeLabel(entry.folderName) ?? fallbackCategoryName
    const group = groups.get(category) ?? []

    group.push(entry)
    groups.set(category, group)
  }

  return groups
}

function categoryLabel(label: string, countryCode: string | null) {
  const normalizedLabel = normalizeLabel(label) ?? "Imported Feeds"

  if (!countryCode) {
    return normalizedLabel
  }

  const prefix = countryCode.toUpperCase()

  return normalizedLabel.toUpperCase().startsWith(`${prefix} `)
    ? normalizedLabel
    : `${prefix} ${normalizedLabel}`
}

function categorySlug(label: string, countryCode: string | null) {
  const baseLabel = countryCode
    ? label.replace(new RegExp(`^${countryCode}\\s+`, "i"), "")
    : label

  return countryCode
    ? `${countryCode}-${slugify(baseLabel)}`
    : `opml-${slugify(baseLabel)}`
}

function categoryDescription(label: string, description: string | null | undefined) {
  const normalizedDescription = normalizeLabel(description)

  return (
    normalizedDescription?.slice(0, MAX_DESCRIPTION_LENGTH) ??
    `${label} RSS feeds imported from OPML.`
  )
}

function uniqueSlug(slug: string, usedSlugs: Set<string>) {
  let nextSlug = slug || "imported"
  let suffix = 2

  while (usedSlugs.has(nextSlug)) {
    nextSlug = `${slug}-${suffix}`
    suffix += 1
  }

  usedSlugs.add(nextSlug)
  return nextSlug
}

function uniqueAliases(urls: readonly string[], canonicalUrl: string) {
  const canonical = canonicalUrl.trim()
  const aliases: string[] = []
  const seen = new Set<string>()

  for (const url of urls) {
    const alias = url.trim()
    const normalized = normalizeUrlForComparison(alias) ?? alias

    if (!alias || alias === canonical || seen.has(normalized)) {
      continue
    }

    seen.add(normalized)
    aliases.push(alias)
  }

  return aliases
}

function normalizeCountryCode(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase()

  return normalized && /^[a-z]{2}$/.test(normalized) ? normalized : null
}

function normalizeLabel(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") || undefined
}

function fileNameStem(fileName: string | null | undefined) {
  const normalized = normalizeLabel(fileName)

  return normalized?.replace(/\.[a-z0-9]+$/i, "")
}

function opmlTitle(opmlXml: string) {
  const match = opmlXml.match(/<title>([^<]+)<\/title>/i)

  return match?.[1]
}

function slugify(value: string) {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return slug || "imported"
}

function sourceFromUrl(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "")
  } catch {
    return "imported feed"
  }
}

function normalizeUrlForComparison(value: string) {
  try {
    const url = new URL(value)

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null
    }

    url.protocol = "https:"
    url.hostname = url.hostname.toLowerCase()
    url.hash = ""
    url.port = ""
    url.searchParams.sort()

    if (url.pathname !== "/") {
      url.pathname = url.pathname.replace(/\/+$/, "") || "/"
    }

    return url.href
  } catch {
    return null
  }
}

function errorMessage(error: unknown) {
  if (error instanceof OpmlError) {
    return error.message
  }

  if (error instanceof Error && error.message) {
    return error.message.slice(0, 500)
  }

  return "The feed could not be verified."
}

function getDiscoverImportStore() {
  return getPrisma() as unknown as DiscoverImportStore
}

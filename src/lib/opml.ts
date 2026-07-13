import { XMLParser } from "fast-xml-parser"

import { getPrisma } from "./db"
import { enqueueFeedRefresh as enqueueFeedRefreshJob } from "./feed-refresh-queue"
import {
  FeedSubscriptionError,
  subscribeToFeed as subscribeToFeedSubscription,
} from "./feed-subscriptions"

export const MAX_OPML_IMPORT_ENTRIES = 250
export const MAX_OPML_NESTING_DEPTH = 10
export const MAX_OPML_URL_LENGTH = 2_048

type OpmlOutline = {
  htmlUrl?: unknown
  outline?: OpmlOutline | OpmlOutline[]
  text?: unknown
  title?: unknown
  type?: unknown
  xmlUrl?: unknown
}

type OpmlStore = {
  folder: {
    create(args: {
      data: {
        name: string
        userId: string
      }
      select: {
        id: true
        name: true
      }
    }): Promise<{ id: string; name: string }>
    findFirst(args: {
      select: { id: true; name: true }
      where: {
        name: string
        userId: string
      }
    }): Promise<{ id: string; name: string } | null>
  }
  importJob: {
    create(args: {
      data: {
        status: "PROCESSING"
        totalFeeds: number
        userId: string
      }
      select: { id: true }
    }): Promise<{ id: string }>
    update(args: {
      data: {
        addedFeeds: number
        errorLog: {
          errors: OpmlImportError[]
          folderCount: number
        }
        failedFeeds: number
        skippedFeeds: number
        status: "COMPLETED" | "FAILED"
        totalFeeds: number
      }
      where: { id: string }
    }): Promise<unknown>
  }
}

export type OpmlSubscriptionEntry = {
  folderName: string | null
  htmlUrl?: string
  title: string
  xmlUrl: string
}

export type OpmlImportError = {
  message: string
  title: string
  xmlUrl: string
}

export type OpmlImportSummary = {
  addedFeeds: number
  errors: OpmlImportError[]
  failedFeeds: number
  folderCount: number
  jobId: string
  skippedFeeds: number
  totalFeeds: number
}

export type OpmlImportJobListItem = {
  addedFeeds: number
  createdAt: Date
  errorCount: number
  failedFeeds: number
  folderCount: number
  id: string
  skippedFeeds: number
  status: string
  totalFeeds: number
}

type ImportOpmlOptions = {
  enqueueFeedRefresh?: (feedId: string) => Promise<unknown>
  opmlXml: string
  store?: OpmlStore
  subscribeToFeed?: typeof subscribeToFeedSubscription
  userId: string
}

export class OpmlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "OpmlError"
  }
}

export function parseOpmlSubscriptions(opmlXml: string): OpmlSubscriptionEntry[] {
  const parser = new XMLParser({
    allowBooleanAttributes: true,
    attributeNamePrefix: "",
    ignoreAttributes: false,
    parseAttributeValue: false,
    trimValues: true,
  })
  let parsed: unknown

  try {
    parsed = parser.parse(opmlXml)
  } catch {
    throw new OpmlError("That OPML file could not be parsed.")
  }

  const body = opmlBody(parsed)
  const outlines = asArray(body.outline)
  const entries: OpmlSubscriptionEntry[] = []

  for (const outline of outlines) {
    collectOutlineSubscriptions(outline, [], entries, 0)
  }

  if (!entries.length) {
    throw new OpmlError("That OPML file does not contain any feed subscriptions.")
  }

  return entries
}

export function buildOpmlDocument({
  ownerName,
  subscriptions,
}: {
  ownerName?: string | null
  subscriptions: OpmlSubscriptionEntry[]
}) {
  const folderMap = new Map<string, OpmlSubscriptionEntry[]>()
  const rootSubscriptions: OpmlSubscriptionEntry[] = []

  for (const subscription of subscriptions) {
    if (subscription.folderName) {
      const folderSubscriptions = folderMap.get(subscription.folderName) ?? []
      folderSubscriptions.push(subscription)
      folderMap.set(subscription.folderName, folderSubscriptions)
    } else {
      rootSubscriptions.push(subscription)
    }
  }

  const bodyLines = [
    ...rootSubscriptions.map((subscription) =>
      `    ${feedOutline(subscription)}`
    ),
    ...Array.from(folderMap.entries()).flatMap(([folderName, feeds]) => [
      `    <outline text="${escapeXmlAttribute(folderName)}" title="${escapeXmlAttribute(folderName)}">`,
      ...feeds.map((feed) => `      ${feedOutline(feed)}`),
      "    </outline>",
    ]),
  ]

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<opml version="2.0">',
    "  <head>",
    "    <title>Arctic RSS subscriptions</title>",
    ownerName
      ? `    <ownerName>${escapeXmlText(ownerName)}</ownerName>`
      : undefined,
    "  </head>",
    "  <body>",
    ...bodyLines,
    "  </body>",
    "</opml>",
    "",
  ]
    .filter((line): line is string => line !== undefined)
    .join("\n")
}

export async function importOpmlForUser(options: ImportOpmlOptions) {
  return importOpmlWithClient(options)
}

export async function importOpmlWithClient({
  enqueueFeedRefresh = enqueueFeedRefreshJob,
  opmlXml,
  store = getOpmlStore(),
  subscribeToFeed = subscribeToFeedSubscription,
  userId,
}: ImportOpmlOptions): Promise<OpmlImportSummary> {
  const entries = parseOpmlSubscriptions(opmlXml)
  const job = await store.importJob.create({
    data: {
      status: "PROCESSING",
      totalFeeds: entries.length,
      userId,
    },
    select: { id: true },
  })
  const folderIdsByName = new Map<string, string>()
  const errors: OpmlImportError[] = []
  let addedFeeds = 0
  let skippedFeeds = 0
  let failedFeeds = 0

  for (const entry of entries) {
    try {
      const folderId = entry.folderName
        ? await getOrCreateImportFolderId({
            folderIdsByName,
            folderName: entry.folderName,
            store,
            userId,
          })
        : undefined
      const subscription = await subscribeToFeed({
        folderId,
        url: entry.xmlUrl,
        userId,
      })

      addedFeeds += 1
      try {
        await enqueueFeedRefresh(subscription.feedId)
      } catch {
        // Import success should not be reversed by a transient queue outage.
      }
    } catch (error) {
      if (isDuplicateSubscriptionError(error)) {
        skippedFeeds += 1
      } else {
        failedFeeds += 1
        errors.push({
          message: errorMessage(error),
          title: entry.title,
          xmlUrl: entry.xmlUrl,
        })
      }
    }
  }

  const summary: OpmlImportSummary = {
    addedFeeds,
    errors,
    failedFeeds,
    folderCount: folderIdsByName.size,
    jobId: job.id,
    skippedFeeds,
    totalFeeds: entries.length,
  }

  await store.importJob.update({
    data: {
      addedFeeds,
      errorLog: {
        errors,
        folderCount: summary.folderCount,
      },
      failedFeeds,
      skippedFeeds,
      status: "COMPLETED",
      totalFeeds: entries.length,
    },
    where: { id: job.id },
  })

  return summary
}

export async function listOpmlExportSubscriptions(
  userId: string
): Promise<OpmlSubscriptionEntry[]> {
  const subscriptions = await getPrisma().feedSubscription.findMany({
    include: {
      feed: true,
      folder: true,
    },
    orderBy: [{ sortOrder: "asc" }, { subscribedAt: "desc" }],
    where: { userId },
  })

  return subscriptions.map((subscription) => ({
    folderName: subscription.folder?.name ?? null,
    htmlUrl: subscription.feed.siteUrl ?? undefined,
    title: subscription.customTitle || subscription.feed.title,
    xmlUrl: subscription.feed.feedUrl,
  }))
}

export async function listUserImportJobs(
  userId: string
): Promise<OpmlImportJobListItem[]> {
  const jobs = await getPrisma().importJob.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      addedFeeds: true,
      createdAt: true,
      errorLog: true,
      failedFeeds: true,
      id: true,
      skippedFeeds: true,
      status: true,
      totalFeeds: true,
    },
    take: 5,
    where: { userId },
  })

  return jobs.map((job) => {
    const errorLog = parseImportErrorLog(job.errorLog)

    return {
      addedFeeds: job.addedFeeds,
      createdAt: job.createdAt,
      errorCount: errorLog.errors.length,
      failedFeeds: job.failedFeeds,
      folderCount: errorLog.folderCount,
      id: job.id,
      skippedFeeds: job.skippedFeeds,
      status: job.status,
      totalFeeds: job.totalFeeds,
    }
  })
}

function opmlBody(parsed: unknown): { outline?: OpmlOutline | OpmlOutline[] } {
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "opml" in parsed &&
    typeof parsed.opml === "object" &&
    parsed.opml !== null &&
    "body" in parsed.opml &&
    typeof parsed.opml.body === "object" &&
    parsed.opml.body !== null
  ) {
    return parsed.opml.body as { outline?: OpmlOutline | OpmlOutline[] }
  }

  throw new OpmlError("That OPML file does not contain a body.")
}

function collectOutlineSubscriptions(
  outline: OpmlOutline,
  folderPath: string[],
  entries: OpmlSubscriptionEntry[],
  depth: number
) {
  if (depth > MAX_OPML_NESTING_DEPTH) {
    throw new OpmlError(
      `OPML folders can be nested no more than ${MAX_OPML_NESTING_DEPTH} levels.`
    )
  }

  const xmlUrl = stringAttribute(outline.xmlUrl)
  const title =
    stringAttribute(outline.title) ||
    stringAttribute(outline.text) ||
    xmlUrl ||
    "Untitled feed"

  if (xmlUrl) {
    if (xmlUrl.length > MAX_OPML_URL_LENGTH) {
      throw new OpmlError(
        `OPML feed URLs must be ${MAX_OPML_URL_LENGTH} characters or fewer.`
      )
    }

    if (entries.length >= MAX_OPML_IMPORT_ENTRIES) {
      throw new OpmlError(
        `OPML imports are limited to ${MAX_OPML_IMPORT_ENTRIES} feeds.`
      )
    }

    entries.push({
      folderName: folderPath.length ? folderPath.join(" / ") : null,
      htmlUrl: stringAttribute(outline.htmlUrl) || undefined,
      title,
      xmlUrl,
    })
    return
  }

  const folderName = normalizeFolderName(title)
  const nextFolderPath = folderName ? [...folderPath, folderName] : folderPath

  for (const childOutline of asArray(outline.outline)) {
    collectOutlineSubscriptions(childOutline, nextFolderPath, entries, depth + 1)
  }
}

function asArray(value: OpmlOutline | OpmlOutline[] | undefined) {
  if (!value) {
    return []
  }

  return Array.isArray(value) ? value : [value]
}

function feedOutline(subscription: OpmlSubscriptionEntry) {
  const attributes = [
    `text="${escapeXmlAttribute(subscription.title)}"`,
    `title="${escapeXmlAttribute(subscription.title)}"`,
    'type="rss"',
    `xmlUrl="${escapeXmlAttribute(subscription.xmlUrl)}"`,
    subscription.htmlUrl
      ? `htmlUrl="${escapeXmlAttribute(subscription.htmlUrl)}"`
      : undefined,
  ]
    .filter((attribute): attribute is string => attribute !== undefined)
    .join(" ")

  return `<outline ${attributes} />`
}

async function getOrCreateImportFolderId({
  folderIdsByName,
  folderName,
  store,
  userId,
}: {
  folderIdsByName: Map<string, string>
  folderName: string
  store: OpmlStore
  userId: string
}) {
  const normalizedFolderName = normalizeFolderName(folderName)

  if (!normalizedFolderName) {
    return undefined
  }

  const cachedFolderId = folderIdsByName.get(normalizedFolderName)

  if (cachedFolderId) {
    return cachedFolderId
  }

  const existingFolder = await store.folder.findFirst({
    select: { id: true, name: true },
    where: {
      name: normalizedFolderName,
      userId,
    },
  })

  if (existingFolder) {
    folderIdsByName.set(normalizedFolderName, existingFolder.id)
    return existingFolder.id
  }

  const folder = await store.folder.create({
    data: {
      name: normalizedFolderName,
      userId,
    },
    select: {
      id: true,
      name: true,
    },
  })

  folderIdsByName.set(normalizedFolderName, folder.id)
  return folder.id
}

function normalizeFolderName(name: string) {
  return name.trim().replace(/\s+/g, " ").slice(0, 80)
}

function stringAttribute(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function escapeXmlAttribute(value: string) {
  return escapeXmlText(value).replace(/"/g, "&quot;")
}

function escapeXmlText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function isDuplicateSubscriptionError(error: unknown) {
  return (
    error instanceof FeedSubscriptionError &&
    error.message.toLowerCase().includes("already subscribed")
  )
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message.slice(0, 500)
  }

  return "OPML import failed for this feed."
}

function parseImportErrorLog(value: unknown) {
  if (
    typeof value === "object" &&
    value !== null &&
    "errors" in value &&
    Array.isArray(value.errors)
  ) {
    return {
      errors: value.errors,
      folderCount:
        "folderCount" in value && typeof value.folderCount === "number"
          ? value.folderCount
          : 0,
    }
  }

  return {
    errors: [],
    folderCount: 0,
  }
}

function getOpmlStore() {
  return getPrisma() as unknown as OpmlStore
}

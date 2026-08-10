import * as cheerio from "cheerio"
import { XMLParser } from "fast-xml-parser"

import {
  decodeStandardXmlEntities,
  ingestionLimits,
  isWithinUtf8ByteLimit,
  safeXmlParserOptions,
  truncateCharacters,
  truncateUtf8Bytes,
  type IngestionParseStats,
} from "./ingestion-limits"
import {
  normalizePublisherExternalIdentity,
  normalizePublisherText,
} from "./publisher-text"
import { normalizeHttpUrl } from "./url-safety"

const xmlParser = new XMLParser({
  attributeNamePrefix: "@",
  ...safeXmlParserOptions,
})

export type ParsedFeedArticle = {
  author?: string
  canonicalUrl?: string
  contentHtml?: string
  contentText?: string
  externalId: string
  imageUrl?: string
  publishedAt?: Date
  summary?: string
  title: string
  url: string
}

export function parseFeedArticles(xml: string, feedUrl: string): ParsedFeedArticle[] {
  return parseFeedArticlesWithMetrics(xml, feedUrl).articles
}

export function parseFeedArticlesWithMetrics(xml: string, feedUrl: string) {
  const parsed = xmlParser.parse(xml) as Record<string, unknown>
  const rss = toRecord(parsed.rss)
  const rdf = toRecord(parsed["rdf:RDF"])
  const channel = firstRecord(rss?.channel ?? rdf?.channel)
  const rssItems = [...toArray(channel?.item), ...toArray(rdf?.item)]
  const atomItems = toArray(toRecord(parsed.feed)?.entry)
  const candidates = [
    ...rssItems.map((item) => () => parseRssArticle(item, feedUrl)),
    ...atomItems.map((item) => () => parseAtomArticle(item, feedUrl)),
  ]
  const boundedCandidates = candidates.slice(0, ingestionLimits.maxFeedItems)
  const articles: ParsedFeedArticle[] = []
  let remainingContentBytes = ingestionLimits.maxAggregateContentBytes
  let fieldsTruncated = 0

  for (const candidate of boundedCandidates) {
    const article = candidate()
    if (!article) {
      continue
    }

    const normalized = applyContentBudget(article, remainingContentBytes)
    remainingContentBytes -= normalized.contentBytes
    fieldsTruncated += normalized.fieldsTruncated
    articles.push(normalized.article)
  }

  return {
    articles,
    stats: {
      acceptedCount: articles.length,
      contentBytes: ingestionLimits.maxAggregateContentBytes - remainingContentBytes,
      fieldsTruncated,
      parsedCount: candidates.length,
      truncatedCount: candidates.length - boundedCandidates.length,
    } satisfies IngestionParseStats,
  }
}

function parseRssArticle(item: unknown, feedUrl: string): ParsedFeedArticle | null {
  const record = toRecord(item)

  if (!record) {
    return null
  }

  const title = boundedTitle(textValue(record.title)) ?? "Untitled"
  const links = [...toArray(record.link), ...toArray(record["atom:link"])]
  const url = normalizeOptionalUrl(findArticleLink(links), feedUrl)

  if (!url) {
    return null
  }

  const summary = boundedSummary(textValue(record.description))
  const contentHtml = boundedContent(
    textValue(record["content:encoded"]) ?? textValue(record.description)
  )
  const contentText = boundedContent(plainText(contentHtml))
  const imageUrl =
    imageFromMediaContent(record["media:content"], feedUrl) ??
    imageFromMediaThumbnail(record["media:thumbnail"], feedUrl) ??
    imageFromEnclosure(record.enclosure, feedUrl) ??
    imageFromHtml(contentHtml, feedUrl)
  const publishedAt = parseOptionalDate(
    textValue(record.pubDate) ??
      textValue(record.published) ??
      textValue(record["dc:date"]) ??
      textValue(record.updated)
  )
  const canonicalUrl = normalizeOptionalUrl(findCanonicalLink(links), feedUrl)

  const externalId =
    externalIdentityValue(record.guid) ??
    externalIdentityValue(record.id) ??
    url ??
    stableTitleFallback(title, publishedAt)
  if (!isWithinUtf8ByteLimit(externalId, ingestionLimits.maxExternalIdBytes)) {
    return null
  }

  return {
    author: truncateCharacters(
      textValue(record["dc:creator"]) ?? textValue(record.creator) ?? textValue(record.author),
      ingestionLimits.maxAuthorCharacters
    ),
    ...(canonicalUrl ? { canonicalUrl } : {}),
    contentHtml,
    contentText,
    externalId,
    imageUrl,
    publishedAt,
    summary,
    title,
    url,
  }
}

function parseAtomArticle(entry: unknown, feedUrl: string): ParsedFeedArticle | null {
  const record = toRecord(entry)

  if (!record) {
    return null
  }

  const mediaGroup = toRecord(record["media:group"])
  const title = boundedTitle(textValue(record.title)) ?? "Untitled"
  const url = normalizeOptionalUrl(findAtomAlternateLink(record.link), feedUrl)

  if (!url) {
    return null
  }

  const summary = boundedSummary(
    textValue(record.summary) ?? textValue(mediaGroup?.["media:description"])
  )
  const contentHtml = boundedContent(
    textValue(record.content) ??
      textValue(mediaGroup?.["media:description"]) ??
      textValue(record.summary)
  )
  const contentText = boundedContent(plainText(contentHtml))
  const publishedAt = parseOptionalDate(
    textValue(record.published) ?? textValue(record.updated)
  )
  const canonicalUrl = normalizeOptionalUrl(findCanonicalLink(record.link), feedUrl)

  const externalId = externalIdentityValue(record.id) ?? url ?? stableTitleFallback(title, publishedAt)
  if (!isWithinUtf8ByteLimit(externalId, ingestionLimits.maxExternalIdBytes)) {
    return null
  }

  return {
    author: truncateCharacters(atomAuthor(record.author), ingestionLimits.maxAuthorCharacters),
    ...(canonicalUrl ? { canonicalUrl } : {}),
    contentHtml,
    contentText,
    externalId,
    imageUrl:
      imageFromMediaContent(record["media:content"], feedUrl) ??
      imageFromMediaContent(mediaGroup?.["media:content"], feedUrl) ??
      imageFromMediaThumbnail(record["media:thumbnail"], feedUrl) ??
      imageFromMediaThumbnail(mediaGroup?.["media:thumbnail"], feedUrl) ??
      imageFromHtml(contentHtml, feedUrl),
    publishedAt,
    summary,
    title,
    url,
  }
}

function toArray(value: unknown) {
  if (Array.isArray(value)) {
    return value
  }

  return value ? [value] : []
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  return null
}

function firstRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    return toRecord(value[0])
  }

  return toRecord(value)
}

function textValue(value: unknown): string | undefined {
  if (typeof value === "string" || typeof value === "number") {
    return normalizePublisherText(decodeStandardXmlEntities(String(value))).value.trim() || undefined
  }

  if (Array.isArray(value)) {
    return textValue(value[0])
  }

  const record = toRecord(value)

  if (record) {
    return textValue(record["#text"])
  }

  return undefined
}

function externalIdentityValue(value: unknown): string | undefined {
  if (typeof value === "string" || typeof value === "number") {
    return normalizePublisherExternalIdentity(
      decodeStandardXmlEntities(String(value))
    ).value.trim() || undefined
  }

  if (Array.isArray(value)) {
    return externalIdentityValue(value[0])
  }

  const record = toRecord(value)

  if (record) {
    return externalIdentityValue(record["#text"])
  }

  return undefined
}

function plainText(value: string | undefined) {
  if (!value) {
    return undefined
  }

  const text = cheerio.load(value).text().replace(/\s+/g, " ").trim()

  return text || undefined
}

function boundedTitle(value: string | undefined) {
  return truncateCharacters(
    plainText(truncateCharacters(value, ingestionLimits.maxTitleCharacters)),
    ingestionLimits.maxTitleCharacters
  )
}

function boundedSummary(value: string | undefined) {
  return truncateCharacters(
    plainText(truncateCharacters(value, ingestionLimits.maxSummaryCharacters)),
    ingestionLimits.maxSummaryCharacters
  )
}

function boundedContent(value: string | undefined) {
  return truncateUtf8Bytes(value, ingestionLimits.maxContentBytesPerField)
}

function applyContentBudget(article: ParsedFeedArticle, remainingContentBytes: number) {
  let contentBytes = 0
  let fieldsTruncated = 0
  const result = { ...article }

  for (const field of ["contentHtml", "contentText"] as const) {
    const value = result[field]
    if (!value) {
      continue
    }

    const bytes = Buffer.byteLength(value, "utf8")
    if (bytes > remainingContentBytes) {
      delete result[field]
      fieldsTruncated += 1
      continue
    }

    remainingContentBytes -= bytes
    contentBytes += bytes
  }

  return { article: result, contentBytes, fieldsTruncated }
}

function normalizeOptionalUrl(value: string | undefined, baseUrl: string) {
  if (!value || value.length > ingestionLimits.maxUrlCharacters) {
    return undefined
  }

  try {
    const normalized = normalizeHttpUrl(new URL(value, baseUrl).href).href
    return normalized.length <= ingestionLimits.maxUrlCharacters ? normalized : undefined
  } catch {
    return undefined
  }
}

function parseOptionalDate(value: string | undefined) {
  if (!value) {
    return undefined
  }

  const date = new Date(value)

  return Number.isNaN(date.valueOf()) ? undefined : date
}

function imageFromMediaContent(value: unknown, feedUrl: string) {
  for (const item of toArray(value)) {
    const record = toRecord(item)
    const medium = textValue(record?.["@medium"])
    const type = textValue(record?.["@type"])
    const url = textValue(record?.["@url"])

    if (
      url &&
      (!medium || medium === "image") &&
      (!type || type.toLowerCase().startsWith("image/"))
    ) {
      return normalizeOptionalUrl(url, feedUrl)
    }
  }

  return undefined
}

function imageFromMediaThumbnail(value: unknown, feedUrl: string) {
  for (const item of toArray(value)) {
    const url = textValue(toRecord(item)?.["@url"])

    if (url) {
      return normalizeOptionalUrl(url, feedUrl)
    }
  }

  return undefined
}

function imageFromEnclosure(value: unknown, feedUrl: string) {
  for (const item of toArray(value)) {
    const record = toRecord(item)
    const type = textValue(record?.["@type"])
    const url = textValue(record?.["@url"])

    if (url && (!type || type.toLowerCase().startsWith("image/"))) {
      return normalizeOptionalUrl(url, feedUrl)
    }
  }

  return undefined
}

function imageFromHtml(value: string | undefined, feedUrl: string) {
  if (!value) {
    return undefined
  }

  const src = cheerio.load(value)("img[src]").first().attr("src")

  return normalizeOptionalUrl(src, feedUrl)
}

function findAtomAlternateLink(value: unknown) {
  return findArticleLink(value)
}

function findArticleLink(value: unknown) {
  const links = toArray(value)
  const preferred =
    links.find((link) => {
      const relations = linkRelations(link)

      return !relations.length || relations.includes("alternate")
    }) ?? links.find((link) => Boolean(linkHref(link)))

  return preferred ? linkHref(preferred) : undefined
}

function findCanonicalLink(value: unknown) {
  return toArray(value)
    .filter((link) => linkRelations(link).includes("canonical"))
    .map(linkHref)
    .find((href): href is string => Boolean(href))
}

function linkHref(value: unknown) {
  const record = toRecord(value)

  return textValue(record?.["@href"]) ?? textValue(value)
}

function linkRelations(value: unknown) {
  return textValue(toRecord(value)?.["@rel"])
    ?.toLowerCase()
    .split(/\s+/)
    .filter(Boolean) ?? []
}

function atomAuthor(value: unknown) {
  const author = firstRecord(value)

  return textValue(author?.name) ?? textValue(value)
}

function stableTitleFallback(title: string, publishedAt: Date | undefined) {
  return publishedAt ? `${title}:${publishedAt.toISOString()}` : title
}

import * as cheerio from "cheerio"
import { XMLParser } from "fast-xml-parser"

import { normalizeHttpUrl } from "./url-safety"

const xmlParser = new XMLParser({
  allowBooleanAttributes: true,
  attributeNamePrefix: "@",
  ignoreAttributes: false,
  trimValues: true,
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
  const parsed = xmlParser.parse(xml) as Record<string, unknown>

  return [...parseRssArticles(parsed, feedUrl), ...parseAtomArticles(parsed, feedUrl)]
}

function parseRssArticles(parsed: Record<string, unknown>, feedUrl: string) {
  const rss = toRecord(parsed.rss)
  const rdf = toRecord(parsed["rdf:RDF"])
  const channel = firstRecord(rss?.channel ?? rdf?.channel)
  const rssItems = toArray(channel?.item)
  const rdfItems = toArray(rdf?.item)

  return [...rssItems, ...rdfItems]
    .map((item) => parseRssArticle(item, feedUrl))
    .filter((article) => article !== null)
}

function parseRssArticle(item: unknown, feedUrl: string): ParsedFeedArticle | null {
  const record = toRecord(item)

  if (!record) {
    return null
  }

  const title = plainText(textValue(record.title)) ?? "Untitled"
  const url = normalizeOptionalUrl(textValue(record.link), feedUrl)

  if (!url) {
    return null
  }

  const summary = plainText(textValue(record.description))
  const contentHtml = textValue(record["content:encoded"]) ?? textValue(record.description)
  const contentText = plainText(contentHtml)
  const imageUrl =
    imageFromMediaContent(record["media:content"], feedUrl) ??
    imageFromEnclosure(record.enclosure, feedUrl) ??
    imageFromHtml(contentHtml, feedUrl)
  const publishedAt = parseOptionalDate(
    textValue(record.pubDate) ??
      textValue(record.published) ??
      textValue(record["dc:date"]) ??
      textValue(record.updated)
  )

  return {
    author:
      textValue(record["dc:creator"]) ??
      textValue(record.creator) ??
      textValue(record.author),
    contentHtml,
    contentText,
    externalId:
      textValue(record.guid) ??
      textValue(record.id) ??
      url ??
      stableTitleFallback(title, publishedAt),
    imageUrl,
    publishedAt,
    summary,
    title,
    url,
  }
}

function parseAtomArticles(parsed: Record<string, unknown>, feedUrl: string) {
  const feed = toRecord(parsed.feed)

  if (!feed) {
    return []
  }

  return toArray(feed.entry)
    .map((entry) => parseAtomArticle(entry, feedUrl))
    .filter((article) => article !== null)
}

function parseAtomArticle(entry: unknown, feedUrl: string): ParsedFeedArticle | null {
  const record = toRecord(entry)

  if (!record) {
    return null
  }

  const title = plainText(textValue(record.title)) ?? "Untitled"
  const url = normalizeOptionalUrl(findAtomAlternateLink(record.link), feedUrl)

  if (!url) {
    return null
  }

  const summary = plainText(textValue(record.summary))
  const contentHtml = textValue(record.content) ?? textValue(record.summary)
  const contentText = plainText(contentHtml)
  const publishedAt = parseOptionalDate(
    textValue(record.published) ?? textValue(record.updated)
  )

  return {
    author: atomAuthor(record.author),
    contentHtml,
    contentText,
    externalId: textValue(record.id) ?? url ?? stableTitleFallback(title, publishedAt),
    imageUrl: imageFromHtml(contentHtml, feedUrl),
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
    return String(value).trim() || undefined
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

function plainText(value: string | undefined) {
  if (!value) {
    return undefined
  }

  const text = cheerio.load(value).text().replace(/\s+/g, " ").trim()

  return text || undefined
}

function normalizeOptionalUrl(value: string | undefined, baseUrl: string) {
  if (!value) {
    return undefined
  }

  try {
    return normalizeHttpUrl(new URL(value, baseUrl).href).href
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
  const links = toArray(value)
  const fallback = links.find((link) => toRecord(link)?.["@href"])

  const alternate =
    links.find((link) => {
      const record = toRecord(link)
      const rel = textValue(record?.["@rel"])

      return record?.["@href"] && (!rel || rel === "alternate")
    }) ?? fallback

  return textValue(toRecord(alternate)?.["@href"])
}

function atomAuthor(value: unknown) {
  const author = firstRecord(value)

  return textValue(author?.name) ?? textValue(value)
}

function stableTitleFallback(title: string, publishedAt: Date | undefined) {
  return publishedAt ? `${title}:${publishedAt.toISOString()}` : title
}

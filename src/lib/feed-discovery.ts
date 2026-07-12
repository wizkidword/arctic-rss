import * as cheerio from "cheerio"
import { XMLParser } from "fast-xml-parser"

import { normalizeHttpUrl, safeFetchText } from "./url-safety"
import {
  extractYouTubeChannelIdFromHtml,
  isYouTubeHost,
  youtubeFeedUrlForInput,
  youtubeFeedUrlFromChannelId,
} from "./youtube-feeds"

const commonFeedPaths = ["/feed", "/rss", "/rss.xml", "/atom.xml", "/index.xml"]

const xmlParser = new XMLParser({
  allowBooleanAttributes: true,
  attributeNamePrefix: "@",
  ignoreAttributes: false,
  trimValues: true,
})

export class FeedValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "FeedValidationError"
  }
}

export type FeedFormat = "rss" | "atom"

export type ParsedFeedMetadata = {
  description?: string
  faviconUrl?: string
  format: FeedFormat
  language?: string
  siteUrl?: string
  title: string
}

export type DiscoveredFeed = ParsedFeedMetadata & {
  feedUrl: string
  feedXml: string
}

type FeedDiscoveryFetch = (
  url: URL
) => Promise<Awaited<ReturnType<typeof safeFetchText>>>

type FeedDiscoveryOptions = {
  fetchText?: FeedDiscoveryFetch
}

export async function discoverFeedFromUrl(
  input: string,
  { fetchText = safeFetchText }: FeedDiscoveryOptions = {}
): Promise<DiscoveredFeed> {
  const startUrl = normalizeHttpUrl(input)
  const directYouTubeFeedUrl = youtubeFeedUrlForInput(startUrl)

  if (directYouTubeFeedUrl && directYouTubeFeedUrl !== startUrl.href) {
    try {
      const response = await fetchText(normalizeHttpUrl(directYouTubeFeedUrl))
      const feed = tryParseFeedXml(response.text, response.url.href)

      if (feed) {
        return {
          ...feed,
          feedUrl: response.url.href,
          feedXml: response.text,
        }
      }
    } catch {
      // Fall through to the ordinary discovery flow for a helpful final error.
    }
  }

  let firstFetchError: unknown = null
  let firstResponse: Awaited<ReturnType<typeof safeFetchText>> | null = null

  try {
    firstResponse = await fetchText(startUrl)
  } catch (error) {
    firstFetchError = error
  }

  if (firstResponse) {
    const directFeed = tryParseFeedXml(firstResponse.text, firstResponse.url.href)

    if (directFeed) {
      return {
        ...directFeed,
        feedUrl: firstResponse.url.href,
        feedXml: firstResponse.text,
      }
    }
  }

  const candidates = extractFeedCandidatesFromHtml(
    firstResponse?.text ?? "",
    firstResponse?.url.href ?? startUrl.href
  )
  const youtubeChannelFeedUrl =
    firstResponse &&
    (isYouTubeHost(firstResponse.url.hostname) || isYouTubeHost(startUrl.hostname))
      ? youtubeFeedUrlFromChannelId(
          extractYouTubeChannelIdFromHtml(firstResponse.text) ?? ""
        )
      : null

  for (const candidate of dedupeUrls([
    ...(youtubeChannelFeedUrl ? [youtubeChannelFeedUrl] : []),
    ...candidates,
  ])) {
    try {
      const candidateUrl = normalizeHttpUrl(candidate)
      const response = await fetchText(candidateUrl)
      const feed = tryParseFeedXml(response.text, response.url.href)

      if (feed) {
        return {
          ...feed,
          feedUrl: response.url.href,
          feedXml: response.text,
        }
      }
    } catch {
      // Keep trying discovered candidates; the final error should be helpful.
    }
  }

  if (firstFetchError instanceof Error) {
    throw firstFetchError
  }

  throw new FeedValidationError(
    "No readable RSS or Atom feed was found for that URL."
  )
}

export function parseFeedXml(xml: string, feedUrl: string): ParsedFeedMetadata {
  const parsed = parseXml(xml)
  const rssFeed = parseRssFeed(parsed, feedUrl)

  if (rssFeed) {
    return rssFeed
  }

  const atomFeed = parseAtomFeed(parsed, feedUrl)

  if (atomFeed) {
    return atomFeed
  }

  throw new FeedValidationError("The URL did not return a valid RSS or Atom feed.")
}

function tryParseFeedXml(xml: string, feedUrl: string) {
  try {
    return parseFeedXml(xml, feedUrl)
  } catch {
    return null
  }
}

function parseXml(xml: string) {
  try {
    return xmlParser.parse(xml) as Record<string, unknown>
  } catch {
    throw new FeedValidationError("The feed XML could not be parsed.")
  }
}

function parseRssFeed(parsed: Record<string, unknown>, feedUrl: string) {
  const rss = toRecord(parsed.rss)
  const rdf = toRecord(parsed["rdf:RDF"])
  const channel = firstRecord(rss?.channel ?? rdf?.channel)

  if (!channel) {
    return null
  }

  const title = textValue(channel.title)

  if (!title) {
    return null
  }

  const siteUrl = normalizeOptionalUrl(textValue(channel.link), feedUrl)

  return {
    description: textValue(channel.description),
    faviconUrl: faviconFromSiteUrl(siteUrl),
    format: "rss" as const,
    language: textValue(channel.language),
    siteUrl,
    title,
  }
}

function parseAtomFeed(parsed: Record<string, unknown>, feedUrl: string) {
  const feed = toRecord(parsed.feed)

  if (!feed) {
    return null
  }

  const title = textValue(feed.title)

  if (!title) {
    return null
  }

  const siteUrl = normalizeOptionalUrl(findAtomAlternateLink(feed.link), feedUrl)

  return {
    description: textValue(feed.subtitle),
    faviconUrl: faviconFromSiteUrl(siteUrl),
    format: "atom" as const,
    language: textValue(feed["@xml:lang"] ?? feed["@lang"]),
    siteUrl,
    title,
  }
}

export function extractFeedCandidatesFromHtml(html: string, pageUrl: string) {
  const page = normalizeHttpUrl(pageUrl)
  const $ = cheerio.load(html)
  const candidates: string[] = []

  $("link[href]").each((_, element) => {
    const rel = String($(element).attr("rel") ?? "").toLowerCase()
    const type = String($(element).attr("type") ?? "").toLowerCase()
    const href = $(element).attr("href")

    if (!href || !rel.split(/\s+/).includes("alternate")) {
      return
    }

    if (
      type.includes("rss") ||
      type.includes("atom") ||
      type === "application/xml" ||
      type === "text/xml"
    ) {
      candidates.push(new URL(href, page).href)
    }
  })

  for (const path of commonFeedPaths) {
    candidates.push(new URL(path, page.origin).href)
  }

  return dedupeUrls(candidates)
}

function dedupeUrls(urls: string[]) {
  const seen = new Set<string>()
  const deduped: string[] = []

  for (const url of urls) {
    try {
      const normalized = normalizeHttpUrl(url).href

      if (!seen.has(normalized)) {
        seen.add(normalized)
        deduped.push(normalized)
      }
    } catch {
      // Ignore unsafe discovered URLs.
    }
  }

  return deduped
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

function findAtomAlternateLink(value: unknown) {
  const links = Array.isArray(value) ? value : [value]
  const fallback = links.find((link) => toRecord(link)?.["@href"])

  const alternate =
    links.find((link) => {
      const record = toRecord(link)
      const rel = textValue(record?.["@rel"])

      return record?.["@href"] && (!rel || rel === "alternate")
    }) ?? fallback

  return textValue(toRecord(alternate)?.["@href"])
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

function faviconFromSiteUrl(siteUrl: string | undefined) {
  if (!siteUrl) {
    return undefined
  }

  return new URL("/favicon.ico", siteUrl).href
}

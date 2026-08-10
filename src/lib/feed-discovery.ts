import * as cheerio from "cheerio"
import { XMLParser } from "fast-xml-parser"

import {
  decodeStandardXmlEntities,
  ingestionLimits,
  safeXmlParserOptions,
  truncateCharacters,
} from "./ingestion-limits"
import { normalizePublisherText } from "./publisher-text"
import { normalizeHttpUrl, safeFetchText, type SafeFetchTextOptions } from "./url-safety"
import {
  extractYouTubeChannelIdFromHtml,
  isYouTubeHost,
  youtubeFeedUrlForInput,
  youtubeFeedUrlFromChannelId,
} from "./youtube-feeds"

const commonFeedPaths = ["/feed", "/rss", "/rss.xml", "/atom.xml", "/index.xml"]
const xmlParser = new XMLParser({
  attributeNamePrefix: "@",
  ...safeXmlParserOptions,
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
  feedSelfUrl?: string
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
  url: URL,
  options?: SafeFetchTextOptions
) => Promise<Awaited<ReturnType<typeof safeFetchText>>>

type FeedDiscoveryOptions = {
  fetchText?: FeedDiscoveryFetch
  limits?: Pick<IngestionDiscoveryLimits, "maxDiscoveryCandidates" | "maxDiscoveryDurationMs">
  now?: () => number
}

type IngestionDiscoveryLimits = typeof ingestionLimits

export async function discoverFeedFromUrl(
  input: string,
  { fetchText = safeFetchText, limits = ingestionLimits, now = Date.now }: FeedDiscoveryOptions = {}
): Promise<DiscoveredFeed> {
  const startedAt = performance.now()
  const deadline = now() + limits.maxDiscoveryDurationMs
  const controller = new AbortController()
  let budgetExhausted = false
  const deadlineTimer = setTimeout(() => {
    budgetExhausted = true
    controller.abort()
  }, limits.maxDiscoveryDurationMs)
  let fetchesUsed = 0
  const fetchWithinBudget = async (url: URL) => {
    const remainingMs = deadline - now()
    if (controller.signal.aborted || remainingMs <= 0 || fetchesUsed >= limits.maxDiscoveryCandidates) {
      budgetExhausted = true
      throw new FeedValidationError("The feed discovery request budget was exhausted.")
    }

    fetchesUsed += 1
    return fetchText(url, {
      parentSignal: controller.signal,
      totalTimeoutMs: remainingMs,
    })
  }
  try {
    const startUrl = normalizeHttpUrl(input)
    const directYouTubeFeedUrl = youtubeFeedUrlForInput(startUrl)

    if (directYouTubeFeedUrl && directYouTubeFeedUrl !== startUrl.href) {
      try {
        const response = await fetchWithinBudget(normalizeHttpUrl(directYouTubeFeedUrl))
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
      firstResponse = await fetchWithinBudget(startUrl)
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
      if (fetchesUsed >= limits.maxDiscoveryCandidates || controller.signal.aborted || now() >= deadline) {
        budgetExhausted = true
        break
      }

      try {
        const candidateUrl = normalizeHttpUrl(candidate)
        const response = await fetchWithinBudget(candidateUrl)
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

    if (controller.signal.aborted || now() >= deadline) {
      budgetExhausted = true
      throw new FeedValidationError("The feed discovery request budget was exhausted.")
    }

    if (firstFetchError instanceof Error) {
      throw firstFetchError
    }

    throw new FeedValidationError(
      "No readable RSS or Atom feed was found for that URL."
    )
  } finally {
    clearTimeout(deadlineTimer)
    console.info(
      JSON.stringify({
        event: "source_discovery_metrics",
        sourceKind: "feed-discovery",
        source_discovery_attempts: fetchesUsed,
        source_discovery_budget_exhausted: budgetExhausted,
        source_discovery_duration_ms: Math.max(0, Math.round(performance.now() - startedAt)),
      })
    )
  }
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

  const title = truncateCharacters(textValue(channel.title), ingestionLimits.maxTitleCharacters)

  if (!title) {
    return null
  }

  const siteUrl = normalizeOptionalUrl(textValue(channel.link), feedUrl)
  const feedSelfUrl = normalizeOptionalUrl(
    findFeedLink(channel["atom:link"] ?? channel.link, "self"),
    feedUrl
  )

  return {
    description: truncateCharacters(textValue(channel.description), ingestionLimits.maxSummaryCharacters),
    faviconUrl: faviconFromSiteUrl(siteUrl),
    feedSelfUrl,
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

  const title = truncateCharacters(textValue(feed.title), ingestionLimits.maxTitleCharacters)

  if (!title) {
    return null
  }

  const siteUrl = normalizeOptionalUrl(findFeedLink(feed.link, "alternate"), feedUrl)
  const feedSelfUrl = normalizeOptionalUrl(findFeedLink(feed.link, "self"), feedUrl)

  return {
    description: truncateCharacters(textValue(feed.subtitle), ingestionLimits.maxSummaryCharacters),
    faviconUrl: faviconFromSiteUrl(siteUrl),
    feedSelfUrl,
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

function findFeedLink(value: unknown, relation: "alternate" | "self") {
  const links = Array.isArray(value) ? value : [value]
  const fallback = links.find((link) => toRecord(link)?.["@href"])

  const matchingLink =
    links.find((link) => {
      const record = toRecord(link)
      const rel = textValue(record?.["@rel"])

      return (
        record?.["@href"] &&
        (relation === "alternate" ? !rel || rel === "alternate" : rel === relation)
      )
    }) ?? (relation === "alternate" ? fallback : undefined)

  return textValue(toRecord(matchingLink)?.["@href"])
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

function faviconFromSiteUrl(siteUrl: string | undefined) {
  if (!siteUrl) {
    return undefined
  }

  return new URL("/favicon.ico", siteUrl).href
}

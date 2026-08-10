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

const audioExtensions = new Set([
  ".aac",
  ".flac",
  ".m4a",
  ".m4b",
  ".mp3",
  ".mp4",
  ".ogg",
  ".opus",
  ".wav",
])

const transcriptTypeRanks = new Map([
  ["text/vtt", 0],
  ["application/x-subrip", 1],
  ["text/plain", 2],
])

export type ParsedPodcastEpisode = {
  audioLengthBytes?: bigint
  audioType?: string
  audioUrl: string
  contentHtml?: string
  contentText?: string
  description?: string
  durationSeconds?: number
  externalId: string
  imageUrl?: string
  publishedAt?: Date
  title: string
  transcriptLanguage?: string
  transcriptRel?: string
  transcriptType?: string
  transcriptUrl?: string
  url?: string
}

export type ParsedPodcastFeed = {
  artworkUrl?: string
  author?: string
  description?: string
  episodes: ParsedPodcastEpisode[]
  feedUrl: string
  language?: string
  siteUrl?: string
  title: string
}

export class PodcastParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PodcastParseError"
  }
}

export function parsePodcastFeed(xml: string, feedUrl: string): ParsedPodcastFeed {
  return parsePodcastFeedWithMetrics(xml, feedUrl).podcast
}

export function parsePodcastFeedWithMetrics(xml: string, feedUrl: string) {
  const parsed = parseXml(xml)
  const candidate = parseRssPodcast(parsed, feedUrl) ?? parseAtomPodcast(parsed, feedUrl)

  if (!candidate) {
    throw new PodcastParseError("Podcast RSS channel was not found.")
  }

  if (candidate.podcast.episodes.length === 0) {
    throw new PodcastParseError("No audio episodes were found in that podcast feed.")
  }

  const normalized = applyContentBudget(candidate.podcast.episodes)
  return {
    podcast: { ...candidate.podcast, episodes: normalized.episodes },
    stats: {
      acceptedCount: normalized.episodes.length,
      contentBytes: normalized.contentBytes,
      fieldsTruncated: candidate.fieldsTruncated + normalized.fieldsTruncated,
      parsedCount: candidate.parsedCount,
      truncatedCount: candidate.truncatedCount,
    } satisfies IngestionParseStats,
  }
}

function parseXml(xml: string) {
  try {
    return xmlParser.parse(xml) as Record<string, unknown>
  } catch {
    throw new PodcastParseError("Podcast feed XML could not be parsed.")
  }
}

function parseRssPodcast(
  parsed: Record<string, unknown>,
  feedUrl: string
): ParsedPodcastCandidate | null {
  const rss = toRecord(parsed.rss)
  const rdf = toRecord(parsed["rdf:RDF"])
  const channel = firstRecord(rss?.channel ?? rdf?.channel)

  if (!channel) {
    return null
  }

  const title = truncateCharacters(textValue(channel.title), ingestionLimits.maxTitleCharacters) ?? "Untitled Podcast"
  const language = textValue(channel.language)
  const description = truncateCharacters(
    textValue(channel.description) ?? textValue(channel["itunes:subtitle"]),
    ingestionLimits.maxSummaryCharacters
  )
  const sourceEpisodes = [...toArray(channel.item), ...toArray(rdf?.item)]
  const selectedEpisodes = sourceEpisodes.slice(0, ingestionLimits.maxPodcastEpisodes)
  const episodes = selectedEpisodes
    .map((item) => parseRssEpisode(item, feedUrl, language))
    .filter((episode) => episode !== null)

  return {
    fieldsTruncated: 0,
    parsedCount: sourceEpisodes.length,
    podcast: {
      artworkUrl: imageFromItunes(channel["itunes:image"], feedUrl),
      author: truncateCharacters(
        textValue(channel["itunes:author"]) ?? textValue(channel.author),
        ingestionLimits.maxAuthorCharacters
      ),
      description,
      episodes,
      feedUrl,
      language,
      siteUrl: normalizeOptionalUrl(textValue(channel.link), feedUrl),
      title,
    },
    truncatedCount: sourceEpisodes.length - selectedEpisodes.length,
  }
}

function parseRssEpisode(
  item: unknown,
  feedUrl: string,
  feedLanguage: string | undefined
): ParsedPodcastEpisode | null {
  const record = toRecord(item)

  if (!record) {
    return null
  }

  const enclosure = findAudioRssEnclosure(record.enclosure, feedUrl)

  if (!enclosure) {
    return null
  }

  const title = truncateCharacters(textValue(record.title), ingestionLimits.maxTitleCharacters) ?? "Untitled Episode"
  const url = normalizeOptionalUrl(textValue(record.link), feedUrl)
  const description = truncateCharacters(textValue(record.description), ingestionLimits.maxSummaryCharacters)
  const contentHtml = truncateUtf8Bytes(
    textValue(record["content:encoded"]),
    ingestionLimits.maxContentBytesPerField
  )
  const transcript = preferredTranscript(record["podcast:transcript"], feedUrl)
  const publishedAt = parseOptionalDate(
    textValue(record.pubDate) ??
      textValue(record.published) ??
      textValue(record["dc:date"]) ??
      textValue(record.updated)
  )

  const externalId =
    externalIdentityValue(record.guid) ??
    externalIdentityValue(record.id) ??
    url ??
    enclosure.url ??
    stableTitleFallback(title, publishedAt)
  if (!isWithinUtf8ByteLimit(externalId, ingestionLimits.maxExternalIdBytes)) {
    return null
  }

  return {
    audioLengthBytes: parseOptionalBigInt(enclosure.length),
    audioType: enclosure.type,
    audioUrl: enclosure.url,
    contentHtml,
    contentText: truncateUtf8Bytes(
      textValue(record["itunes:summary"]) ?? description,
      ingestionLimits.maxContentBytesPerField
    ),
    description,
    durationSeconds: parseDuration(textValue(record["itunes:duration"])),
    externalId,
    imageUrl:
      imageFromItunes(record["itunes:image"], feedUrl) ??
      imageFromMediaContent(record["media:content"], feedUrl) ??
      imageFromMediaThumbnail(record["media:thumbnail"], feedUrl),
    publishedAt,
    title,
    ...transcriptFields(transcript, feedLanguage),
    url,
  }
}

function parseAtomPodcast(
  parsed: Record<string, unknown>,
  feedUrl: string
): ParsedPodcastCandidate | null {
  const feed = toRecord(parsed.feed)

  if (!feed) {
    return null
  }

  const title = truncateCharacters(textValue(feed.title), ingestionLimits.maxTitleCharacters) ?? "Untitled Podcast"
  const language = textValue(feed["@xml:lang"] ?? feed["@lang"])
  const sourceEpisodes = toArray(feed.entry)
  const selectedEpisodes = sourceEpisodes.slice(0, ingestionLimits.maxPodcastEpisodes)
  const episodes = selectedEpisodes
    .map((entry) => parseAtomEpisode(entry, feedUrl, language))
    .filter((episode) => episode !== null)

  return {
    fieldsTruncated: 0,
    parsedCount: sourceEpisodes.length,
    podcast: {
      artworkUrl:
        imageFromItunes(feed["itunes:image"], feedUrl) ??
        normalizeOptionalUrl(textValue(feed.icon) ?? textValue(feed.logo), feedUrl),
      author: truncateCharacters(
        textValue(feed["itunes:author"]) ?? atomAuthor(feed.author),
        ingestionLimits.maxAuthorCharacters
      ),
      description: truncateCharacters(
        textValue(feed.subtitle) ?? textValue(feed.summary),
        ingestionLimits.maxSummaryCharacters
      ),
      episodes,
      feedUrl,
      language,
      siteUrl: normalizeOptionalUrl(findAtomAlternateLink(feed.link), feedUrl),
      title,
    },
    truncatedCount: sourceEpisodes.length - selectedEpisodes.length,
  }
}

function parseAtomEpisode(
  entry: unknown,
  feedUrl: string,
  feedLanguage: string | undefined
): ParsedPodcastEpisode | null {
  const record = toRecord(entry)

  if (!record) {
    return null
  }

  const enclosure = findAudioAtomEnclosure(record.link, feedUrl)

  if (!enclosure) {
    return null
  }

  const title = truncateCharacters(textValue(record.title), ingestionLimits.maxTitleCharacters) ?? "Untitled Episode"
  const url = normalizeOptionalUrl(findAtomAlternateLink(record.link), feedUrl)
  const description = truncateCharacters(textValue(record.summary), ingestionLimits.maxSummaryCharacters)
  const contentHtml = truncateUtf8Bytes(textValue(record.content), ingestionLimits.maxContentBytesPerField)
  const transcript = preferredTranscript(record["podcast:transcript"], feedUrl)
  const publishedAt = parseOptionalDate(
    textValue(record.published) ?? textValue(record.updated)
  )

  const externalId =
    externalIdentityValue(record.id) ?? url ?? enclosure.url ?? stableTitleFallback(title, publishedAt)
  if (!isWithinUtf8ByteLimit(externalId, ingestionLimits.maxExternalIdBytes)) {
    return null
  }

  return {
    audioLengthBytes: parseOptionalBigInt(enclosure.length),
    audioType: enclosure.type,
    audioUrl: enclosure.url,
    contentHtml,
    contentText: truncateUtf8Bytes(
      description ?? textValue(record.content),
      ingestionLimits.maxContentBytesPerField
    ),
    description,
    durationSeconds: parseDuration(textValue(record["itunes:duration"])),
    externalId,
    imageUrl:
      imageFromItunes(record["itunes:image"], feedUrl) ??
      imageFromMediaContent(record["media:content"], feedUrl) ??
      imageFromMediaThumbnail(record["media:thumbnail"], feedUrl),
    publishedAt,
    title,
    ...transcriptFields(transcript, feedLanguage),
    url,
  }
}

function findAudioRssEnclosure(value: unknown, feedUrl: string) {
  for (const item of toArray(value)) {
    const record = toRecord(item)
    const url = normalizeOptionalUrl(textValue(record?.["@url"]), feedUrl)
    const type = textValue(record?.["@type"])

    if (url && isAudioEnclosure(url, type)) {
      return {
        length: textValue(record?.["@length"]),
        type,
        url,
      }
    }
  }

  return undefined
}

function findAudioAtomEnclosure(value: unknown, feedUrl: string) {
  for (const link of toArray(value)) {
    const record = toRecord(link)
    const rel = textValue(record?.["@rel"])?.toLowerCase()
    const url = normalizeOptionalUrl(textValue(record?.["@href"]), feedUrl)
    const type = textValue(record?.["@type"])

    if (url && rel === "enclosure" && isAudioEnclosure(url, type)) {
      return {
        length: textValue(record?.["@length"]),
        type,
        url,
      }
    }
  }

  return undefined
}

function preferredTranscript(value: unknown, feedUrl: string) {
  return toArray(value)
    .map((item) => {
      const record = toRecord(item)
      const type = normalizeTranscriptType(textValue(record?.["@type"]))
      const url = normalizeOptionalUrl(textValue(record?.["@url"]), feedUrl)

      if (!type || !url) {
        return undefined
      }

      return {
        language: textValue(record?.["@language"]),
        rel: textValue(record?.["@rel"])?.toLowerCase(),
        type,
        url,
      }
    })
    .filter((transcript): transcript is NonNullable<typeof transcript> => Boolean(transcript))
    .sort((left, right) => transcriptTypeRanks.get(left.type)! - transcriptTypeRanks.get(right.type)!)[0]
}

function normalizeTranscriptType(value: string | undefined) {
  const type = value?.toLowerCase().split(";", 1)[0]?.trim()

  return type && transcriptTypeRanks.has(type) ? type : undefined
}

function transcriptFields(
  transcript:
    | {
        language?: string
        rel?: string
        type: string
        url: string
      }
    | undefined,
  feedLanguage: string | undefined
) {
  return transcript
    ? {
        transcriptLanguage: transcript.language ?? feedLanguage,
        transcriptRel: transcript.rel,
        transcriptType: transcript.type,
        transcriptUrl: transcript.url,
      }
    : {}
}

function parseDuration(value: string | undefined) {
  if (!value) {
    return undefined
  }

  if (/^\d+$/.test(value)) {
    return Number(value)
  }

  const parts = value.split(":")

  if (
    parts.length < 2 ||
    parts.length > 3 ||
    parts.some((part) => !/^\d+$/.test(part))
  ) {
    return undefined
  }

  const [hours, minutes, seconds] =
    parts.length === 2 ? [0, Number(parts[0]), Number(parts[1])] : parts.map(Number)

  if (minutes >= 60 || seconds >= 60) {
    return undefined
  }

  return hours * 60 * 60 + minutes * 60 + seconds
}

function parseOptionalBigInt(value: string | undefined) {
  if (!value || !/^\d+$/.test(value)) {
    return undefined
  }

  try {
    return BigInt(value)
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

function isAudioEnclosure(url: string, type: string | undefined) {
  if (type) {
    return type.toLowerCase().startsWith("audio/")
  }

  return audioExtensions.has(audioExtensionFromUrl(url))
}

function audioExtensionFromUrl(value: string) {
  try {
    return extensionFromPath(new URL(value).pathname)
  } catch {
    return extensionFromPath(value)
  }
}

function extensionFromPath(path: string) {
  const lastDot = path.lastIndexOf(".")

  return lastDot === -1 ? "" : path.slice(lastDot).toLowerCase()
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

type ParsedPodcastCandidate = {
  fieldsTruncated: number
  parsedCount: number
  podcast: ParsedPodcastFeed
  truncatedCount: number
}

function applyContentBudget(episodes: ParsedPodcastEpisode[]) {
  const normalized: ParsedPodcastEpisode[] = []
  let remainingContentBytes = ingestionLimits.maxAggregateContentBytes
  let contentBytes = 0
  let fieldsTruncated = 0

  for (const episode of episodes) {
    const result = { ...episode }
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
    normalized.push(result)
  }

  return { contentBytes, episodes: normalized, fieldsTruncated }
}

function imageFromItunes(value: unknown, feedUrl: string) {
  const record = firstRecord(value)

  return normalizeOptionalUrl(
    textValue(record?.["@href"]) ?? textValue(value),
    feedUrl
  )
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

function findAtomAlternateLink(value: unknown) {
  const links = toArray(value)
  const fallback = links.find((link) => toRecord(link)?.["@href"])

  const alternate =
    links.find((link) => {
      const record = toRecord(link)
      const rel = textValue(record?.["@rel"])?.toLowerCase()

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

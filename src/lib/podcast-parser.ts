import { XMLParser } from "fast-xml-parser"

import { normalizeHttpUrl } from "./url-safety"

const xmlParser = new XMLParser({
  allowBooleanAttributes: true,
  attributeNamePrefix: "@",
  ignoreAttributes: false,
  trimValues: true,
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
  const parsed = parseXml(xml)
  const podcast = parseRssPodcast(parsed, feedUrl) ?? parseAtomPodcast(parsed, feedUrl)

  if (!podcast) {
    throw new PodcastParseError("Podcast RSS channel was not found.")
  }

  if (podcast.episodes.length === 0) {
    throw new PodcastParseError("No audio episodes were found in that podcast feed.")
  }

  return podcast
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
): ParsedPodcastFeed | null {
  const rss = toRecord(parsed.rss)
  const rdf = toRecord(parsed["rdf:RDF"])
  const channel = firstRecord(rss?.channel ?? rdf?.channel)

  if (!channel) {
    return null
  }

  const title = textValue(channel.title) ?? "Untitled Podcast"
  const description =
    textValue(channel.description) ?? textValue(channel["itunes:subtitle"])
  const episodes = [...toArray(channel.item), ...toArray(rdf?.item)]
    .map((item) => parseRssEpisode(item, feedUrl))
    .filter((episode) => episode !== null)

  return {
    artworkUrl: imageFromItunes(channel["itunes:image"], feedUrl),
    author: textValue(channel["itunes:author"]) ?? textValue(channel.author),
    description,
    episodes,
    feedUrl,
    language: textValue(channel.language),
    siteUrl: normalizeOptionalUrl(textValue(channel.link), feedUrl),
    title,
  }
}

function parseRssEpisode(
  item: unknown,
  feedUrl: string
): ParsedPodcastEpisode | null {
  const record = toRecord(item)

  if (!record) {
    return null
  }

  const enclosure = findAudioRssEnclosure(record.enclosure, feedUrl)

  if (!enclosure) {
    return null
  }

  const title = textValue(record.title) ?? "Untitled Episode"
  const url = normalizeOptionalUrl(textValue(record.link), feedUrl)
  const description = textValue(record.description)
  const contentHtml = textValue(record["content:encoded"])
  const publishedAt = parseOptionalDate(
    textValue(record.pubDate) ??
      textValue(record.published) ??
      textValue(record["dc:date"]) ??
      textValue(record.updated)
  )

  return {
    audioLengthBytes: parseOptionalBigInt(enclosure.length),
    audioType: enclosure.type,
    audioUrl: enclosure.url,
    contentHtml,
    contentText: textValue(record["itunes:summary"]) ?? description,
    description,
    durationSeconds: parseDuration(textValue(record["itunes:duration"])),
    externalId:
      textValue(record.guid) ??
      textValue(record.id) ??
      url ??
      enclosure.url ??
      stableTitleFallback(title, publishedAt),
    imageUrl:
      imageFromItunes(record["itunes:image"], feedUrl) ??
      imageFromMediaContent(record["media:content"], feedUrl) ??
      imageFromMediaThumbnail(record["media:thumbnail"], feedUrl),
    publishedAt,
    title,
    url,
  }
}

function parseAtomPodcast(
  parsed: Record<string, unknown>,
  feedUrl: string
): ParsedPodcastFeed | null {
  const feed = toRecord(parsed.feed)

  if (!feed) {
    return null
  }

  const title = textValue(feed.title) ?? "Untitled Podcast"
  const episodes = toArray(feed.entry)
    .map((entry) => parseAtomEpisode(entry, feedUrl))
    .filter((episode) => episode !== null)

  return {
    artworkUrl:
      imageFromItunes(feed["itunes:image"], feedUrl) ??
      normalizeOptionalUrl(textValue(feed.icon) ?? textValue(feed.logo), feedUrl),
    author: textValue(feed["itunes:author"]) ?? atomAuthor(feed.author),
    description: textValue(feed.subtitle) ?? textValue(feed.summary),
    episodes,
    feedUrl,
    language: textValue(feed["@xml:lang"] ?? feed["@lang"]),
    siteUrl: normalizeOptionalUrl(findAtomAlternateLink(feed.link), feedUrl),
    title,
  }
}

function parseAtomEpisode(
  entry: unknown,
  feedUrl: string
): ParsedPodcastEpisode | null {
  const record = toRecord(entry)

  if (!record) {
    return null
  }

  const enclosure = findAudioAtomEnclosure(record.link, feedUrl)

  if (!enclosure) {
    return null
  }

  const title = textValue(record.title) ?? "Untitled Episode"
  const url = normalizeOptionalUrl(findAtomAlternateLink(record.link), feedUrl)
  const description = textValue(record.summary)
  const contentHtml = textValue(record.content)
  const publishedAt = parseOptionalDate(
    textValue(record.published) ?? textValue(record.updated)
  )

  return {
    audioLengthBytes: parseOptionalBigInt(enclosure.length),
    audioType: enclosure.type,
    audioUrl: enclosure.url,
    contentHtml,
    contentText: description ?? textValue(record.content),
    description,
    durationSeconds: parseDuration(textValue(record["itunes:duration"])),
    externalId:
      textValue(record.id) ?? url ?? enclosure.url ?? stableTitleFallback(title, publishedAt),
    imageUrl:
      imageFromItunes(record["itunes:image"], feedUrl) ??
      imageFromMediaContent(record["media:content"], feedUrl) ??
      imageFromMediaThumbnail(record["media:thumbnail"], feedUrl),
    publishedAt,
    title,
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

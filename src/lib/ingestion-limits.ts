import type { PublisherPublicationDateDiagnostics } from "./publisher-publication-date"

export type IngestionLimits = {
  maxAggregateContentBytes: number
  maxAuthorCharacters: number
  maxContentBytesPerField: number
  maxDiscoveryCandidates: number
  maxDiscoveryDurationMs: number
  maxExternalIdBytes: number
  maxFeedItems: number
  maxPodcastEpisodes: number
  maxSummaryCharacters: number
  maxTitleCharacters: number
  maxUrlCharacters: number
}

export type IngestionParseStats = {
  acceptedCount: number
  contentBytes: number
  fieldsTruncated: number
  parsedCount: number
  publicationDateDiagnostics: PublisherPublicationDateDiagnostics
  truncatedCount: number
}

const KIB = 1024
const MIB = KIB * KIB

const defaults: IngestionLimits = {
  maxAggregateContentBytes: 4 * MIB,
  maxAuthorCharacters: 500,
  maxContentBytesPerField: 256 * KIB,
  maxDiscoveryCandidates: 6,
  maxDiscoveryDurationMs: 30_000,
  maxExternalIdBytes: 4_096,
  maxFeedItems: 1_000,
  maxPodcastEpisodes: 1_000,
  maxSummaryCharacters: 16_000,
  maxTitleCharacters: 1_000,
  maxUrlCharacters: 4_096,
}

export const ingestionLimits = getIngestionLimits()

export const safeXmlParserOptions = {
  allowBooleanAttributes: true,
  ignoreAttributes: false,
  processEntities: false,
  trimValues: true,
} as const

export function getIngestionLimits(
  environment: Readonly<Record<string, string | undefined>> = process.env
): IngestionLimits {
  return {
    maxAggregateContentBytes: boundedEnvironmentInteger(
      environment,
      "INGESTION_MAX_AGGREGATE_CONTENT_BYTES",
      defaults.maxAggregateContentBytes,
      KIB,
      16 * MIB
    ),
    maxAuthorCharacters: boundedEnvironmentInteger(
      environment,
      "INGESTION_MAX_AUTHOR_CHARACTERS",
      defaults.maxAuthorCharacters,
      1,
      4_096
    ),
    maxContentBytesPerField: boundedEnvironmentInteger(
      environment,
      "INGESTION_MAX_CONTENT_BYTES_PER_FIELD",
      defaults.maxContentBytesPerField,
      KIB,
      MIB
    ),
    maxDiscoveryCandidates: boundedEnvironmentInteger(
      environment,
      "INGESTION_MAX_DISCOVERY_CANDIDATES",
      defaults.maxDiscoveryCandidates,
      1,
      12
    ),
    maxDiscoveryDurationMs: boundedEnvironmentInteger(
      environment,
      "INGESTION_MAX_DISCOVERY_DURATION_MS",
      defaults.maxDiscoveryDurationMs,
      1_000,
      60_000
    ),
    maxExternalIdBytes: boundedEnvironmentInteger(
      environment,
      "INGESTION_MAX_EXTERNAL_ID_BYTES",
      defaults.maxExternalIdBytes,
      64,
      16 * KIB
    ),
    maxFeedItems: boundedEnvironmentInteger(
      environment,
      "INGESTION_MAX_FEED_ITEMS",
      defaults.maxFeedItems,
      1,
      2_000
    ),
    maxPodcastEpisodes: boundedEnvironmentInteger(
      environment,
      "INGESTION_MAX_PODCAST_EPISODES",
      defaults.maxPodcastEpisodes,
      1,
      2_000
    ),
    maxSummaryCharacters: boundedEnvironmentInteger(
      environment,
      "INGESTION_MAX_SUMMARY_CHARACTERS",
      defaults.maxSummaryCharacters,
      1,
      64_000
    ),
    maxTitleCharacters: boundedEnvironmentInteger(
      environment,
      "INGESTION_MAX_TITLE_CHARACTERS",
      defaults.maxTitleCharacters,
      1,
      4_096
    ),
    maxUrlCharacters: boundedEnvironmentInteger(
      environment,
      "INGESTION_MAX_URL_CHARACTERS",
      defaults.maxUrlCharacters,
      256,
      16_384
    ),
  }
}

export function truncateCharacters(value: string | undefined, maximum: number) {
  if (!value) {
    return undefined
  }

  return value.length <= maximum ? value : value.slice(0, maximum)
}

export function truncateUtf8Bytes(value: string | undefined, maximum: number) {
  if (!value) {
    return undefined
  }

  if (Buffer.byteLength(value, "utf8") <= maximum) {
    return value
  }

  let result = ""
  let used = 0
  for (const character of value) {
    const bytes = Buffer.byteLength(character, "utf8")
    if (used + bytes > maximum) {
      break
    }
    result += character
    used += bytes
  }

  return result
}

export function isWithinUtf8ByteLimit(value: string | undefined, maximum: number) {
  return typeof value === "string" && Buffer.byteLength(value, "utf8") <= maximum
}

export function decodeStandardXmlEntities(value: string) {
  return value.replace(/&(?:amp|apos|gt|lt|quot);|&#(?:x[0-9a-f]+|\d+);/gi, (entity) => {
    switch (entity.toLowerCase()) {
      case "&amp;":
        return "&"
      case "&apos;":
        return "'"
      case "&gt;":
        return ">"
      case "&lt;":
        return "<"
      case "&quot;":
        return '"'
      default: {
        const numeric = entity.slice(2, -1)
        const hexadecimal = numeric.startsWith("x") || numeric.startsWith("X")
        const codePoint = Number.parseInt(hexadecimal ? numeric.slice(1) : numeric, hexadecimal ? 16 : 10)
        return isUnicodeScalarValue(codePoint) ? String.fromCodePoint(codePoint) : entity
      }
    }
  })
}

function isUnicodeScalarValue(value: number) {
  return Number.isInteger(value) && value >= 0 && value <= 0x10ffff && (value < 0xd800 || value > 0xdfff)
}

function boundedEnvironmentInteger(
  environment: Readonly<Record<string, string | undefined>>,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number
) {
  const value = environment[name]?.trim()
  if (!value || !/^\d+$/.test(value)) {
    return fallback
  }

  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback
}

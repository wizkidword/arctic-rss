import { createHash } from "node:crypto"

export const INGESTION_FINGERPRINT_VERSION = "v1"

type CanonicalValue = Date | bigint | number | string | null | undefined

type FingerprintField = readonly [string, CanonicalValue]

export function articleIngestionFingerprint(article: {
  author?: string
  canonicalUrl?: string
  contentHtml?: string
  contentText?: string
  imageUrl?: string
  publishedAt?: Date
  summary?: string
  title: string
  url: string
}) {
  return fingerprint([
    ["title", article.title],
    ["url", article.url],
    ["canonicalUrl", article.canonicalUrl],
    ["author", article.author],
    ["summary", article.summary],
    ["contentHtml", article.contentHtml],
    ["contentText", article.contentText],
    ["imageUrl", article.imageUrl],
    ["publishedAt", article.publishedAt],
  ])
}

export function podcastEpisodeIngestionFingerprint(episode: {
  audioLengthBytes?: bigint
  audioType?: string
  audioUrl: string
  contentHtml?: string
  contentText?: string
  description?: string
  durationSeconds?: number
  imageUrl?: string
  publishedAt?: Date
  title: string
  transcriptLanguage?: string
  transcriptRel?: string
  transcriptType?: string
  transcriptUrl?: string
  url?: string
}) {
  return fingerprint([
    ["title", episode.title],
    ["url", episode.url],
    ["description", episode.description],
    ["contentHtml", episode.contentHtml],
    ["contentText", episode.contentText],
    ["audioUrl", episode.audioUrl],
    ["audioType", episode.audioType],
    ["audioLengthBytes", episode.audioLengthBytes],
    ["durationSeconds", episode.durationSeconds],
    ["imageUrl", episode.imageUrl],
    ["transcriptUrl", episode.transcriptUrl],
    ["transcriptType", episode.transcriptType],
    ["transcriptLanguage", episode.transcriptLanguage],
    ["transcriptRel", episode.transcriptRel],
    ["publishedAt", episode.publishedAt],
  ])
}

function fingerprint(fields: readonly FingerprintField[]) {
  const canonical = JSON.stringify(
    fields.map(([key, value]) => [key, canonicalValue(value)])
  )
  const digest = createHash("sha256").update(canonical, "utf8").digest("hex")

  return `${INGESTION_FINGERPRINT_VERSION}:${digest}`
}

function canonicalValue(value: CanonicalValue) {
  if (value === null || value === undefined) {
    return null
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === "bigint") {
    return value.toString(10)
  }

  return typeof value === "string" ? value.normalize("NFC") : value
}

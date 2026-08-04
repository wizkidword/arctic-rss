import { createHash } from "node:crypto"

import Redis from "ioredis"
import sanitizeHtml from "sanitize-html"

import { getPrisma } from "./db"
import { ephemeralRedisConnectionOptions } from "./redis-config"
import {
  createHostRequestLimiter,
  FeedFetchError,
  normalizeHttpUrl,
  safeFetchText,
  UnsafeUrlError,
  type HostRequestLimiter,
  type SafeFetchTextOptions,
  type SafeFetchTextResult,
} from "./url-safety"

const MAX_TRANSCRIPT_BYTES = 1024 * 1024
const MAX_TRANSCRIPT_CUES = 3000
const MAX_CACHED_TRANSCRIPT_BYTES = 512 * 1024
const POSITIVE_CACHE_TTL_MS = 2 * 60_000
const NEGATIVE_CACHE_TTL_MS = 30_000
const TRANSCRIPT_CACHE_NAMESPACE = "arctic-rss:podcast-transcript:v1"
const GLOBAL_TRANSCRIPT_FETCH_CONCURRENCY = 4

const supportedTranscriptTypes = new Set([
  "application/x-subrip",
  "text/plain",
  "text/vtt",
])

const timedTranscriptTypes = new Set([
  "application/x-subrip",
  "text/vtt",
])

const podcastTranscriptFailureReasons = new Set<PodcastTranscriptFailureReason>([
  "parse_failure",
  "oversized_response",
  "timeout",
  "unsafe_destination",
  "unsupported_format",
  "upstream_unavailable",
])

export type PodcastTranscriptCue = {
  endSeconds?: number
  startSeconds?: number
  text: string
}

export type PodcastEpisodeTranscript = {
  cues: PodcastTranscriptCue[]
  isCaptions: boolean
  language: string | null
  type: string
}

export type PodcastTranscriptFailureReason =
  | "parse_failure"
  | "oversized_response"
  | "timeout"
  | "unsafe_destination"
  | "unsupported_format"
  | "upstream_unavailable"

export class PodcastTranscriptError extends Error {
  constructor(public readonly reason: PodcastTranscriptFailureReason) {
    super("The transcript could not be retrieved safely.")
    this.name = "PodcastTranscriptError"
  }
}

type PodcastEpisodeTranscriptReference = {
  transcriptLanguage: string | null
  transcriptRel: string | null
  transcriptType: string | null
  transcriptUrl: string | null
}

type PodcastTranscriptStore = {
  podcastEpisode: {
    findFirst(args: {
      select: {
        transcriptLanguage: true
        transcriptRel: true
        transcriptType: true
        transcriptUrl: true
      }
      where: {
        id: string
        podcast: {
          subscriptions: {
            some: {
              userId: string
            }
          }
        }
      }
    }): Promise<PodcastEpisodeTranscriptReference | null>
  }
}

export type PodcastTranscriptCache = {
  get: (key: string) => Promise<string | null>
  set: (key: string, value: string, mode: "PX", ttlMs: number) => Promise<unknown>
}

type PodcastTranscriptCacheEntry =
  | { kind: "negative"; reason: PodcastTranscriptFailureReason; version: 1 }
  | { kind: "positive"; transcript: PodcastEpisodeTranscript; version: 1 }

type PodcastTranscriptFetchText = (
  url: URL,
  options: Pick<SafeFetchTextOptions, "accept" | "globalRequestLimiter" | "maxBytes">
) => Promise<SafeFetchTextResult>

let transcriptCacheRedis: Redis | undefined
const sharedTranscriptOutboundLimiter = createHostRequestLimiter(
  GLOBAL_TRANSCRIPT_FETCH_CONCURRENCY
)

export async function getPodcastEpisodeTranscriptForUser({
  cache,
  episodeId,
  fetchText = safeFetchText,
  outboundRequestLimiter = sharedTranscriptOutboundLimiter,
  store = getPodcastTranscriptStore(),
  userId,
}: {
  cache?: PodcastTranscriptCache
  episodeId: string
  fetchText?: PodcastTranscriptFetchText
  outboundRequestLimiter?: HostRequestLimiter
  store?: PodcastTranscriptStore
  userId: string
}): Promise<PodcastEpisodeTranscript | null> {
  const episode = await store.podcastEpisode.findFirst({
    select: {
      transcriptLanguage: true,
      transcriptRel: true,
      transcriptType: true,
      transcriptUrl: true,
    },
    where: {
      id: episodeId,
      podcast: {
        subscriptions: {
          some: { userId },
        },
      },
    },
  })

  const transcriptType = episode?.transcriptType
  const transcriptUrl = episode?.transcriptUrl

  if (!transcriptUrl || !transcriptType) {
    return null
  }

  if (!isSupportedPodcastTranscriptType(transcriptType)) {
    throw new PodcastTranscriptError("unsupported_format")
  }

  let transcriptLocation: URL

  try {
    transcriptLocation = normalizeHttpUrl(transcriptUrl)
  } catch (error) {
    if (error instanceof UnsafeUrlError) {
      throw new PodcastTranscriptError("unsafe_destination")
    }

    throw error
  }

  const cacheKey = getTranscriptCacheKey({
    language: episode.transcriptLanguage,
    rel: episode.transcriptRel,
    type: transcriptType,
    url: transcriptLocation,
  })
  const transcriptCache = cache ?? getPodcastTranscriptCache()
  const cachedEntry = await readCachedTranscript(transcriptCache, cacheKey)

  if (cachedEntry?.kind === "positive") {
    return cachedEntry.transcript
  }

  if (cachedEntry?.kind === "negative") {
    throw new PodcastTranscriptError(cachedEntry.reason)
  }

  try {
    const response = await fetchText(transcriptLocation, {
      accept: "text/vtt, application/x-subrip, text/plain;q=0.9, */*;q=0.1",
      globalRequestLimiter: outboundRequestLimiter,
      maxBytes: MAX_TRANSCRIPT_BYTES,
    })

    if (!isCompatiblePodcastTranscriptResponseType({
      declaredType: transcriptType,
      responseType: response.contentType,
    })) {
      throw new PodcastTranscriptError("unsupported_format")
    }

    const transcript: PodcastEpisodeTranscript = {
      cues: parsePodcastTranscript(response.text, transcriptType),
      isCaptions: episode.transcriptRel === "captions",
      language: episode.transcriptLanguage,
      type: transcriptType,
    }

    if (response.text.trim() && transcript.cues.length === 0) {
      throw new PodcastTranscriptError("parse_failure")
    }

    await writeCachedTranscript(transcriptCache, cacheKey, {
      kind: "positive",
      transcript,
      version: 1,
    })

    return transcript
  } catch (error) {
    const failure = toPodcastTranscriptError(error)

    await writeCachedTranscript(transcriptCache, cacheKey, {
      kind: "negative",
      reason: failure.reason,
      version: 1,
    })

    throw failure
  }
}

export function isSupportedPodcastTranscriptType(value: string | null | undefined) {
  return supportedTranscriptTypes.has(normalizePodcastTranscriptType(value) ?? "")
}

function isCompatiblePodcastTranscriptResponseType({
  declaredType,
  responseType,
}: {
  declaredType: string
  responseType: string
}) {
  const normalizedResponseType = normalizePodcastTranscriptType(responseType)

  if (isSupportedPodcastTranscriptType(normalizedResponseType)) {
    return true
  }

  return (
    normalizedResponseType === "application/octet-stream" &&
    timedTranscriptTypes.has(normalizePodcastTranscriptType(declaredType) ?? "")
  )
}

export function parsePodcastTranscript(
  text: string,
  type: string
): PodcastTranscriptCue[] {
  switch (normalizePodcastTranscriptType(type)) {
    case "text/vtt":
    case "application/x-subrip":
      return parseTimedTranscript(text)
    case "text/plain":
      return text
        .replace(/\r\n?/g, "\n")
        .split(/\n\s*\n/)
        .map((block) => normalizeCueText(block))
        .filter(Boolean)
        .slice(0, MAX_TRANSCRIPT_CUES)
        .map((cue) => ({ text: cue }))
    default:
      return []
  }
}

function parseTimedTranscript(text: string): PodcastTranscriptCue[] {
  const lines = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n")
  const cues: PodcastTranscriptCue[] = []

  for (let index = 0; index < lines.length && cues.length < MAX_TRANSCRIPT_CUES; index += 1) {
    const timing = parseCueTiming(lines[index])

    if (!timing) {
      continue
    }

    const cueLines: string[] = []
    index += 1

    while (index < lines.length && lines[index].trim()) {
      cueLines.push(lines[index])
      index += 1
    }

    const cueText = normalizeCueText(cueLines.join(" "))

    if (cueText) {
      cues.push({ ...timing, text: cueText })
    }
  }

  return cues
}

function parseCueTiming(value: string | undefined) {
  const [start, endWithSettings] = value?.split("-->") ?? []

  if (!start || !endWithSettings) {
    return undefined
  }

  const startSeconds = parseTimestamp(start.trim())
  const endSeconds = parseTimestamp(endWithSettings.trim().split(/\s+/, 1)[0])

  return startSeconds === undefined || endSeconds === undefined
    ? undefined
    : { endSeconds, startSeconds }
}

function parseTimestamp(value: string) {
  const parts = value.replace(",", ".").split(":")

  if (parts.length !== 2 && parts.length !== 3) {
    return undefined
  }

  const seconds = Number(parts.at(-1))
  const minutes = Number(parts.at(-2))
  const hours = parts.length === 3 ? Number(parts[0]) : 0

  return [hours, minutes, seconds].every(Number.isFinite) &&
    hours >= 0 &&
    minutes >= 0 &&
    minutes < 60 &&
    seconds >= 0 &&
    seconds < 60
    ? hours * 60 * 60 + minutes * 60 + seconds
    : undefined
}

function normalizeCueText(value: string) {
  return sanitizeHtml(value, {
    allowedAttributes: {},
    allowedTags: [],
  })
    .replace(/\s+/g, " ")
    .trim()
}

function normalizePodcastTranscriptType(value: string | null | undefined) {
  return value?.toLowerCase().split(";", 1)[0]?.trim()
}

function getPodcastTranscriptCache() {
  try {
    if (!transcriptCacheRedis || transcriptCacheRedis.status === "end") {
      transcriptCacheRedis = new Redis(ephemeralRedisConnectionOptions().url, {
        connectTimeout: 1_000,
        maxRetriesPerRequest: 0,
        retryStrategy: () => null,
      })
      transcriptCacheRedis.on("error", () => {
        // Cache errors are intentionally handled as misses without exposing Redis details.
      })
    }

    return transcriptCacheRedis as PodcastTranscriptCache
  } catch {
    return undefined
  }
}

function getTranscriptCacheKey({
  language,
  rel,
  type,
  url,
}: {
  language: string | null
  rel: string | null
  type: string
  url: URL
}) {
  const referenceHash = createHash("sha256")
    .update(JSON.stringify({ language, rel, type: normalizePodcastTranscriptType(type), url: url.href }))
    .digest("hex")

  return `${TRANSCRIPT_CACHE_NAMESPACE}:${referenceHash}`
}

async function readCachedTranscript(
  cache: PodcastTranscriptCache | undefined,
  cacheKey: string
): Promise<PodcastTranscriptCacheEntry | null> {
  if (!cache) {
    return null
  }

  try {
    const value = await cache.get(cacheKey)

    if (!value || Buffer.byteLength(value, "utf8") > MAX_CACHED_TRANSCRIPT_BYTES) {
      return null
    }

    const entry: unknown = JSON.parse(value)

    return isCachedTranscriptEntry(entry) ? entry : null
  } catch {
    return null
  }
}

async function writeCachedTranscript(
  cache: PodcastTranscriptCache | undefined,
  cacheKey: string,
  entry: PodcastTranscriptCacheEntry
) {
  if (!cache) {
    return
  }

  const serialized = JSON.stringify(entry)

  if (Buffer.byteLength(serialized, "utf8") > MAX_CACHED_TRANSCRIPT_BYTES) {
    return
  }

  try {
    await cache.set(
      cacheKey,
      serialized,
      "PX",
      entry.kind === "positive" ? POSITIVE_CACHE_TTL_MS : NEGATIVE_CACHE_TTL_MS
    )
  } catch {
    // A cache miss or write failure must not affect subscriber access to a transcript.
  }
}

function isCachedTranscriptEntry(value: unknown): value is PodcastTranscriptCacheEntry {
  if (!value || typeof value !== "object") {
    return false
  }

  const entry = value as {
    kind?: unknown
    reason?: unknown
    transcript?: unknown
    version?: unknown
  }

  if (entry.version !== 1) {
    return false
  }

  if (entry.kind === "negative") {
    return (
      typeof entry.reason === "string" &&
      podcastTranscriptFailureReasons.has(entry.reason as PodcastTranscriptFailureReason)
    )
  }

  return entry.kind === "positive" && isPodcastEpisodeTranscript(entry.transcript)
}

function isPodcastEpisodeTranscript(value: unknown): value is PodcastEpisodeTranscript {
  if (!value || typeof value !== "object") {
    return false
  }

  const transcript = value as {
    cues?: unknown
    isCaptions?: unknown
    language?: unknown
    type?: unknown
  }

  return (
    Array.isArray(transcript.cues) &&
    transcript.cues.length <= MAX_TRANSCRIPT_CUES &&
    transcript.cues.every(isPodcastTranscriptCue) &&
    typeof transcript.isCaptions === "boolean" &&
    (typeof transcript.language === "string" || transcript.language === null) &&
    typeof transcript.type === "string" &&
    isSupportedPodcastTranscriptType(transcript.type)
  )
}

function isPodcastTranscriptCue(value: unknown): value is PodcastTranscriptCue {
  if (!value || typeof value !== "object") {
    return false
  }

  const cue = value as { endSeconds?: unknown; startSeconds?: unknown; text?: unknown }

  return (
    typeof cue.text === "string" &&
    (cue.startSeconds === undefined || Number.isFinite(cue.startSeconds)) &&
    (cue.endSeconds === undefined || Number.isFinite(cue.endSeconds))
  )
}

function toPodcastTranscriptError(error: unknown) {
  if (error instanceof PodcastTranscriptError) {
    return error
  }

  if (error instanceof UnsafeUrlError) {
    return new PodcastTranscriptError("unsafe_destination")
  }

  if (error instanceof FeedFetchError) {
    if (error.message.includes("too large")) {
      return new PodcastTranscriptError("oversized_response")
    }

    if (error.message.includes("timed out")) {
      return new PodcastTranscriptError("timeout")
    }
  }

  if (error instanceof DOMException && error.name === "TimeoutError") {
    return new PodcastTranscriptError("timeout")
  }

  return new PodcastTranscriptError("upstream_unavailable")
}

function getPodcastTranscriptStore() {
  return getPrisma() as unknown as PodcastTranscriptStore
}

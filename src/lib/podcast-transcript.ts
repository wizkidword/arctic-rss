import { getPrisma } from "./db"
import { normalizeHttpUrl, safeFetchText, type SafeFetchTextResult } from "./url-safety"

const MAX_TRANSCRIPT_BYTES = 1024 * 1024
const MAX_TRANSCRIPT_CUES = 3000

const supportedTranscriptTypes = new Set([
  "application/x-subrip",
  "text/plain",
  "text/vtt",
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

export async function getPodcastEpisodeTranscriptForUser({
  episodeId,
  fetchText = safeFetchText,
  store = getPodcastTranscriptStore(),
  userId,
}: {
  episodeId: string
  fetchText?: (url: URL, options: { accept: string; maxBytes: number }) => Promise<SafeFetchTextResult>
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

  if (!transcriptUrl || !transcriptType || !isSupportedPodcastTranscriptType(transcriptType)) {
    return null
  }

  const response = await fetchText(normalizeHttpUrl(transcriptUrl), {
    accept: "text/vtt, application/x-subrip, text/plain;q=0.9, */*;q=0.1",
    maxBytes: MAX_TRANSCRIPT_BYTES,
  })

  return {
    cues: parsePodcastTranscript(response.text, transcriptType),
    isCaptions: episode.transcriptRel === "captions",
    language: episode.transcriptLanguage,
    type: transcriptType,
  }
}

export function isSupportedPodcastTranscriptType(value: string | null | undefined) {
  return supportedTranscriptTypes.has(normalizePodcastTranscriptType(value) ?? "")
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
  return value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()
}

function normalizePodcastTranscriptType(value: string | null | undefined) {
  return value?.toLowerCase().split(";", 1)[0]?.trim()
}

function getPodcastTranscriptStore() {
  return getPrisma() as unknown as PodcastTranscriptStore
}

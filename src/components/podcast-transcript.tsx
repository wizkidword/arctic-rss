"use client"

import { useMemo, useState } from "react"

type PodcastTranscriptCue = {
  endSeconds?: number
  startSeconds?: number
  text: string
}

type PodcastTranscriptResponse = {
  cues: PodcastTranscriptCue[]
  isCaptions: boolean
  language: string | null
  type: string
}

export type PodcastTranscriptReference = {
  language: string | null
  rel: string | null
  type: string
  url: string
}

export function PodcastTranscript({
  audioElementId,
  episodeId,
  transcript,
}: {
  audioElementId: string
  episodeId: string
  transcript: PodcastTranscriptReference
}) {
  const [data, setData] = useState<PodcastTranscriptResponse | null>(null)
  const [error, setError] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [query, setQuery] = useState("")
  const filteredCues = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()

    return normalizedQuery
      ? (data?.cues ?? []).filter((cue) =>
          cue.text.toLocaleLowerCase().includes(normalizedQuery)
        )
      : (data?.cues ?? [])
  }, [data?.cues, query])

  async function loadTranscript() {
    setError(false)
    setIsLoading(true)

    try {
      const response = await fetch(
        `/api/podcasts/episodes/${encodeURIComponent(episodeId)}/transcript`
      )

      if (!response.ok) {
        throw new Error("Transcript unavailable")
      }

      setData((await response.json()) as PodcastTranscriptResponse)
    } catch {
      setError(true)
    } finally {
      setIsLoading(false)
    }
  }

  function seekToCue(cue: PodcastTranscriptCue) {
    if (cue.startSeconds === undefined) {
      return
    }

    const audio = document.getElementById(audioElementId) as HTMLAudioElement | null

    if (!audio) {
      return
    }

    audio.currentTime = cue.startSeconds
    void audio.play().catch(() => undefined)
  }

  const sourceLabel = transcript.rel === "captions" ? "Publisher captions" : "Publisher transcript"

  return (
    <section className="mt-3 rounded-md border bg-muted/30 p-3" aria-label={sourceLabel}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{sourceLabel}</span>
        {transcript.language ? (
          <span className="text-xs text-muted-foreground">{transcript.language}</span>
        ) : null}
        <a
          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          href={transcript.url}
          rel="noreferrer"
          target="_blank"
        >
          Open at publisher
        </a>
        {!data ? (
          <button
            className="ml-auto rounded-md border px-2 py-1 text-sm font-medium hover:bg-background disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading}
            onClick={() => void loadTranscript()}
            type="button"
          >
            {isLoading ? "Loading…" : "View transcript"}
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="mt-2 text-sm text-destructive">
          This publisher transcript is unavailable right now.
        </p>
      ) : null}
      {data ? (
        <div className="mt-3 space-y-2">
          <label className="block text-sm font-medium" htmlFor={`podcast-transcript-search-${episodeId}`}>
            Search this transcript
          </label>
          <input
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            id={`podcast-transcript-search-${episodeId}`}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a word or phrase"
            type="search"
            value={query}
          />
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1 text-sm">
            {filteredCues.length ? (
              filteredCues.map((cue, index) =>
                cue.startSeconds === undefined ? (
                  <p key={`${cue.text}-${index}`}>{cue.text}</p>
                ) : (
                  <button
                    className="block w-full rounded-md px-2 py-1 text-left hover:bg-background"
                    key={`${cue.startSeconds}-${index}`}
                    onClick={() => seekToCue(cue)}
                    type="button"
                  >
                    <span className="mr-2 font-mono text-xs text-muted-foreground">
                      {formatTimestamp(cue.startSeconds)}
                    </span>
                    {cue.text}
                  </button>
                )
              )
            ) : (
              <p className="text-muted-foreground">No matching transcript text.</p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}

function formatTimestamp(seconds: number) {
  const totalSeconds = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const remainingSeconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`
}

"use client"

import { useEffect, useRef } from "react"
import { ExternalLink } from "lucide-react"

import { savePodcastPlaybackProgressAction } from "@/app/app/podcasts/actions"

export type PodcastPlayerEpisode = {
  audioUrl: string
  episodeId: string
  playbackPositionSeconds: number
  podcastTitle: string
  title: string
  url: string | null
}

export function PodcastPlayer({
  episode,
}: {
  episode: PodcastPlayerEpisode | null
}) {
  const restoredEpisodeIdRef = useRef<string | null>(null)
  const lastSavedPositionRef = useRef(0)

  useEffect(() => {
    restoredEpisodeIdRef.current = null
    lastSavedPositionRef.current = episode?.playbackPositionSeconds ?? 0
  }, [episode?.episodeId, episode?.playbackPositionSeconds])

  if (!episode) {
    return null
  }

  function restorePlaybackPosition(audio: HTMLAudioElement) {
    if (!episode || restoredEpisodeIdRef.current === episode.episodeId) {
      return
    }

    if (episode.playbackPositionSeconds > 0) {
      audio.currentTime = episode.playbackPositionSeconds
    }

    restoredEpisodeIdRef.current = episode.episodeId
    lastSavedPositionRef.current = normalizePlaybackPosition(audio.currentTime)
  }

  function submitProgress(audio: HTMLAudioElement) {
    if (!episode) {
      return
    }

    const playbackPositionSeconds = normalizePlaybackPosition(
      audio.currentTime
    )
    const formData = new FormData()
    formData.set("episodeId", episode.episodeId)
    formData.set(
      "playbackPositionSeconds",
      String(playbackPositionSeconds)
    )
    lastSavedPositionRef.current = playbackPositionSeconds
    void savePodcastPlaybackProgressAction(formData)
  }

  return (
    <section
      aria-label="Podcast player"
      className="rounded-lg border bg-card p-4 text-card-foreground"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-semibold">{episode.title}</h2>
          <p className="text-sm text-muted-foreground">
            {episode.podcastTitle}
          </p>
        </div>
        {episode.url ? (
          <a
            aria-label="Open original episode"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            href={episode.url}
            rel="noreferrer"
            target="_blank"
          >
            <ExternalLink size={16} />
          </a>
        ) : null}
      </div>
      <audio
        aria-label={`Player for ${episode.title}`}
        className="w-full"
        controls
        onPause={(event) => submitProgress(event.currentTarget)}
        onPlay={(event) => restorePlaybackPosition(event.currentTarget)}
        onSeeked={(event) => submitProgress(event.currentTarget)}
        onTimeUpdate={(event) => {
          const currentPosition = normalizePlaybackPosition(
            event.currentTarget.currentTime
          )

          if (currentPosition - lastSavedPositionRef.current >= 15) {
            submitProgress(event.currentTarget)
          }
        }}
        preload="metadata"
        src={episode.audioUrl}
      />
    </section>
  )
}

function normalizePlaybackPosition(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.floor(value))
}

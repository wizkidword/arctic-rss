import { ExternalLink } from "lucide-react"

import { PodcastEpisodeActions } from "@/components/podcast-episode-actions"
import { type ArticleCollectionPickerItem } from "@/lib/article-collections"
import type { PodcastHomeEpisode } from "@/lib/podcasts"
import {
  formatArticleDateTime,
  normalizeDateTimePreferences,
  type DateTimePreferences,
} from "@/lib/settings"

export type PodcastEpisodeListItem = PodcastHomeEpisode

export function PodcastEpisodeList({
  collections = [],
  currentCollection,
  dateTimePreferences,
  episodes,
}: {
  collections?: ArticleCollectionPickerItem[]
  currentCollection?: { id: string; name: string }
  dateTimePreferences?: Partial<DateTimePreferences>
  episodes: PodcastEpisodeListItem[]
}) {
  if (episodes.length === 0) {
    return (
      <section className="rounded-lg border bg-card p-6 text-card-foreground">
        <h2 className="font-semibold">No Episodes</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Subscribe to a podcast to start listening.
        </p>
      </section>
    )
  }

  const normalizedDateTimePreferences =
    normalizeDateTimePreferences(dateTimePreferences)

  return (
    <section className="space-y-2">
      {episodes.map((episode) => (
        <article
          className="rounded-lg border bg-card p-3 text-card-foreground"
          key={episode.episodeId}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate font-semibold">{episode.title}</h2>
              <p className="text-sm text-muted-foreground">
                {episode.podcastTitle}
                {episode.publishedAt
                  ? ` - Aired ${formatArticleDateTime(
                      episode.publishedAt,
                      normalizedDateTimePreferences
                    )}`
                  : ""}
              </p>
              {episode.description ? (
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                  {episode.description}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <PodcastEpisodeActions
                collections={collections}
                currentCollection={currentCollection}
                episode={{
                  episodeId: episode.episodeId,
                  isPlayed: episode.isPlayed,
                  isStarred: episode.isStarred,
                  title: episode.title,
                  url: episode.url,
                }}
              />
              {episode.url ? (
                <a
                  aria-label="Open original episode"
                  className="inline-flex size-8 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  href={episode.url}
                  rel="noreferrer"
                  target="_blank"
                >
                  <ExternalLink size={16} />
                </a>
              ) : null}
            </div>
          </div>
          <audio
            aria-label={`Stream ${episode.title}`}
            className="mt-3 w-full"
            controls
            preload="none"
            src={episode.audioUrl}
          />
        </article>
      ))}
    </section>
  )
}

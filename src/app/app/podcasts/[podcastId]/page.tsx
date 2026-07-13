import Link from "next/link"
import { notFound, redirect } from "next/navigation"

import { auth } from "@/auth"
import { PodcastEpisodeList } from "@/components/podcast-episode-list"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { getPodcastShowForUser } from "@/lib/podcasts"
import { imageProxyUrl } from "@/lib/image-proxy-url"
import { normalizeDateTimePreferences } from "@/lib/settings"
import { getOrCreateUserSettings } from "@/lib/user-settings"

export default async function PodcastShowPage({
  params,
  searchParams = Promise.resolve({}),
}: {
  params: Promise<{ podcastId: string }>
  searchParams?: Promise<{ after?: string | string[] }>
}) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const { podcastId } = await params
  const query = await searchParams
  const [show, settings] = await Promise.all([
    getPodcastShowForUser({
      after: firstSearchParam(query.after),
      podcastId,
      userId: session.user.id,
    }),
    getOrCreateUserSettings(session.user.id),
  ])

  if (!show) {
    notFound()
  }

  const dateTimePreferences = normalizeDateTimePreferences(settings)

  return (
    <main className="space-y-4 p-4">
      <header className="rounded-lg border bg-card p-4 text-card-foreground">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          {imageProxyUrl(show.podcast.artworkUrl) ? (
            // The local security proxy owns caching and response validation.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt=""
              className="size-20 rounded-md object-cover"
              height={80}
              src={imageProxyUrl(show.podcast.artworkUrl) ?? ""}
              width={80}
            />
          ) : (
            <span className="flex size-20 shrink-0 items-center justify-center rounded-md bg-muted text-lg font-semibold">
              {show.podcast.title.slice(0, 2)}
            </span>
          )}
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold">
                {show.podcast.title}
              </h1>
              {show.podcast.lastError ? (
                <Badge variant="destructive">Needs attention</Badge>
              ) : null}
            </div>
            {show.podcast.description ? (
              <p className="max-w-3xl text-sm text-muted-foreground">
                {show.podcast.description}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Link
                className={buttonVariants({ size: "sm", variant: "outline" })}
                href="/app/podcasts"
              >
                All podcasts
              </Link>
              {show.podcast.url ? (
                <a
                  className={buttonVariants({
                    size: "sm",
                    variant: "outline",
                  })}
                  href={show.podcast.url}
                  rel="noreferrer"
                  target="_blank"
                >
                  Podcast site
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </header>
      <PodcastEpisodeList
        dateTimePreferences={dateTimePreferences}
        episodes={show.episodes}
        nextPageHref={nextPageHref(podcastId, show.nextEpisodeCursor)}
      />
    </main>
  )
}

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function nextPageHref(podcastId: string, cursor: string | null) {
  return cursor
    ? `/app/podcasts/${podcastId}?after=${encodeURIComponent(cursor)}`
    : undefined
}

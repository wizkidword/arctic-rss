import Link from "next/link"
import { notFound, redirect } from "next/navigation"

import { auth } from "@/auth"
import { PodcastEpisodeList } from "@/components/podcast-episode-list"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { getPodcastShowForUser } from "@/lib/podcasts"
import { normalizeDateTimePreferences } from "@/lib/settings"
import { getOrCreateUserSettings } from "@/lib/user-settings"

export default async function PodcastShowPage({
  params,
}: {
  params: Promise<{ podcastId: string }>
}) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const { podcastId } = await params
  const [show, settings] = await Promise.all([
    getPodcastShowForUser({
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
          {show.podcast.artworkUrl ? (
            <img
              alt=""
              className="size-20 rounded-md object-cover"
              height={80}
              src={show.podcast.artworkUrl}
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
      />
    </main>
  )
}

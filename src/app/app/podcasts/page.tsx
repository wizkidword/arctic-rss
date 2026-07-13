import Link from "next/link"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { PodcastEpisodeList } from "@/components/podcast-episode-list"
import { buttonVariants } from "@/components/ui/button"
import { getPodcastHomeForUser } from "@/lib/podcasts"
import { imageProxyUrl } from "@/lib/image-proxy-url"
import { normalizeDateTimePreferences } from "@/lib/settings"
import { getOrCreateUserSettings } from "@/lib/user-settings"

import { subscribeToPodcastAction } from "./actions"

export default async function PodcastsPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const [home, settings] = await Promise.all([
    getPodcastHomeForUser(session.user.id),
    getOrCreateUserSettings(session.user.id),
  ])
  const dateTimePreferences = normalizeDateTimePreferences(settings)

  if (home.subscriptions.length === 0) {
    return (
      <main className="space-y-5 p-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold">Podcasts</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Subscribe to podcasts to stream episodes inside Arctic RSS.
          </p>
        </header>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            className={buttonVariants()}
            href="/app/podcasts/discover"
          >
            Discover podcasts
          </Link>
        </div>
        <form
          action={subscribeFromPodcastHome}
          className="max-w-xl space-y-3 rounded-lg border bg-card p-4 text-card-foreground"
        >
          <label className="text-sm font-medium" htmlFor="podcast-url">
            Paste podcast RSS URL
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="min-h-9 flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              id="podcast-url"
              name="url"
              placeholder="https://example.com/podcast.xml"
              type="url"
            />
            <button className={buttonVariants()} type="submit">
              Subscribe
            </button>
          </div>
        </form>
      </main>
    )
  }

  return (
    <main className="grid min-h-full gap-4 p-4 lg:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]">
      <aside className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Podcasts</h1>
          <Link
            className={buttonVariants({ size: "sm", variant: "outline" })}
            href="/app/podcasts/discover"
          >
            Discover
          </Link>
        </div>
        <div className="space-y-2">
          {home.subscriptions.map((subscription) => (
            <Link
              className="flex gap-3 rounded-lg border bg-card p-3 text-card-foreground transition-colors hover:bg-muted"
              href={`/app/podcasts/${subscription.id}`}
              key={subscription.subscriptionId}
            >
              {imageProxyUrl(subscription.artworkUrl) ? (
                // The local security proxy owns caching and response validation.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt=""
                  className="size-12 rounded-md object-cover"
                  height={48}
                  src={imageProxyUrl(subscription.artworkUrl) ?? ""}
                  width={48}
                />
              ) : (
                <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-semibold">
                  {subscription.title.slice(0, 2)}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {subscription.title}
                </span>
                <span className="mt-1 block truncate text-xs text-muted-foreground">
                  {subscription.latestEpisodeTitle ?? "No episodes yet"}
                </span>
                <span className="mt-2 inline-flex rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {subscription.unplayedCount}{" "}
                  {subscription.unplayedCount === 1 ? "unplayed" : "unplayed"}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </aside>
      <section className="min-w-0 space-y-3">
        <div className="rounded-lg border bg-card p-4 text-card-foreground">
          <h2 className="font-semibold">Latest Episodes</h2>
          <p className="text-sm text-muted-foreground">
            Newest episodes from subscribed podcasts.
          </p>
        </div>
        <PodcastEpisodeList
          dateTimePreferences={dateTimePreferences}
          episodes={home.episodes}
        />
      </section>
    </main>
  )
}

async function subscribeFromPodcastHome(formData: FormData) {
  "use server"

  await subscribeToPodcastAction(formData)
}

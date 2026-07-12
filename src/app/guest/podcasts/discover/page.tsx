import Link from "next/link"

import { PodcastSubscribeButton } from "@/components/podcast-subscribe-button"
import { buttonVariants } from "@/components/ui/button"
import {
  listPodcastDirectoryCategories,
  listPodcastDirectoryShows,
  searchPodcastDirectory,
} from "@/lib/podcast-directory"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

const GUEST_PODCAST_READ_ONLY_REASON =
  "Create an account to subscribe to podcasts."

type GuestDiscoverPodcastsSearchParams = {
  category?: string | string[]
  q?: string | string[]
}

export default async function GuestDiscoverPodcastsPage({
  searchParams,
}: {
  searchParams: Promise<GuestDiscoverPodcastsSearchParams>
}) {
  const params = await searchParams
  const categories = listPodcastDirectoryCategories()
  const query = firstSearchParam(params.q)?.trim() ?? ""
  const selectedCategoryId =
    firstSearchParam(params.category) || categories[0]?.id
  const shows = query
    ? searchPodcastDirectory(query)
    : listPodcastDirectoryShows(selectedCategoryId)

  return (
    <main className="space-y-5 p-4">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Discover Podcasts</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Browse curated shows. Create an account to subscribe and stream
            episodes in your library.
          </p>
        </div>
        <Link
          className={buttonVariants({ variant: "outline" })}
          href="/guest"
        >
          Back to Guest Reader
        </Link>
      </header>

      <form className="flex max-w-xl flex-col gap-2 sm:flex-row">
        <input
          aria-label="Search podcasts"
          className="min-h-9 flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          defaultValue={query}
          name="q"
          placeholder="Search podcasts"
          type="search"
        />
        <button className={buttonVariants()} type="submit">
          Search
        </button>
      </form>

      <nav className="flex flex-wrap gap-2" aria-label="Podcast categories">
        {categories.map((category) => {
          const selected = !query && selectedCategoryId === category.id

          return (
            <Link
              className={cn(
                buttonVariants({
                  size: "sm",
                  variant: selected ? "default" : "outline",
                })
              )}
              href={`/guest/podcasts/discover?category=${category.id}`}
              key={category.id}
            >
              {category.label}
            </Link>
          )
        })}
      </nav>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {shows.map((show) => (
          <article
            className="flex gap-3 rounded-lg border bg-card p-3 text-card-foreground"
            key={show.id}
          >
            <img
              alt=""
              className="size-14 rounded-md object-cover"
              height={56}
              src={show.artworkUrl}
              width={56}
            />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="min-w-0">
                <h2 className="truncate font-semibold">{show.title}</h2>
                <p className="truncate text-sm text-muted-foreground">
                  {show.author}
                </p>
              </div>
              <p className="line-clamp-2 text-sm text-muted-foreground">
                {show.description}
              </p>
              <PodcastSubscribeButton
                feedUrl={show.feedUrl}
                readOnlyReason={GUEST_PODCAST_READ_ONLY_REASON}
              />
            </div>
          </article>
        ))}
      </section>

      <section className="max-w-xl space-y-3 rounded-lg border bg-card p-4 text-card-foreground">
        <p className="text-sm font-medium">Paste podcast RSS URL</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="min-h-9 flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60"
            disabled
            placeholder="https://example.com/podcast.xml"
            type="url"
          />
          <button
            className={buttonVariants()}
            disabled
            title={GUEST_PODCAST_READ_ONLY_REASON}
            type="button"
          >
            Subscribe
          </button>
        </div>
      </section>
    </main>
  )
}

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

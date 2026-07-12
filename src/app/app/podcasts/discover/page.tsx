import Link from "next/link"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { PodcastSubscribeButton } from "@/components/podcast-subscribe-button"
import { buttonVariants } from "@/components/ui/button"
import {
  listPodcastDirectoryCategories,
  listPodcastDirectoryShows,
  searchPodcastDirectory,
} from "@/lib/podcast-directory"
import { cn } from "@/lib/utils"

import { subscribeToPodcastAction } from "../actions"

type DiscoverPodcastsSearchParams = {
  category?: string | string[]
  q?: string | string[]
}

export default async function DiscoverPodcastsPage({
  searchParams,
}: {
  searchParams: Promise<DiscoverPodcastsSearchParams>
}) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

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
            Find curated shows, subscribe, and stream episodes in Arctic RSS.
          </p>
        </div>
        <Link
          className={buttonVariants({ variant: "outline" })}
          href="/app/podcasts"
        >
          Back to Podcasts
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
              href={`/app/podcasts/discover?category=${category.id}`}
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
              <PodcastSubscribeButton feedUrl={show.feedUrl} />
            </div>
          </article>
        ))}
      </section>

      <form
        action={subscribeFromDiscover}
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

async function subscribeFromDiscover(formData: FormData) {
  "use server"

  await subscribeToPodcastAction(formData)
}

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

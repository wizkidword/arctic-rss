import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronDownIcon, CompassIcon, RssIcon } from "lucide-react"

import { auth } from "@/auth"
import { FeedDirectorySubscribeButton } from "@/components/feed-directory-subscribe-button"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  feedDirectoryCategories,
  getFeedDirectoryCategory,
  isDirectoryFeedSubscribed,
  listFeedDirectoryFeeds,
} from "@/lib/feed-directory"
import { listUserFeedSubscriptions } from "@/lib/feed-subscriptions"
import { listUserFolders } from "@/lib/folders"
import { cn } from "@/lib/utils"

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string | string[] }>
}) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const query = await searchParams
  const selectedCategory = getFeedDirectoryCategory(
    firstSearchParam(query.category)
  )

  if (!selectedCategory) {
    throw new Error("Feed directory has no categories.")
  }

  const [folders, subscriptions] = await Promise.all([
    listUserFolders(session.user.id),
    listUserFeedSubscriptions(session.user.id),
  ])
  const categoryGroups = feedDirectoryCategories.map((category) => ({
    category,
    feeds: listFeedDirectoryFeeds(category.id),
  }))
  const totalFeedCount = categoryGroups.reduce(
    (count, group) => count + group.feeds.length,
    0
  )
  const subscriptionUrls = subscriptions.map(
    (subscription) => subscription.feedUrl
  )
  const pickerFolders = folders.map(({ id, name }) => ({ id, name }))

  return (
    <div className="flex min-h-screen flex-col gap-4 p-3 sm:p-4 lg:p-6">
      <section className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <CompassIcon className="size-5 text-muted-foreground" />
            <h1 className="font-heading text-xl font-semibold">
              Discover Feeds
            </h1>
            <Badge variant="secondary">{totalFeedCount} feeds</Badge>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Browse curated RSS feeds and add them directly to your reader.
          </p>
        </div>

        <nav
          aria-label="Feed categories"
          className="flex flex-wrap items-center gap-2"
        >
          {feedDirectoryCategories.map((category) => (
            <Link
              aria-current={
                category.id === selectedCategory.id ? "page" : undefined
              }
              className={cn(
                buttonVariants({
                  size: "sm",
                  variant:
                    category.id === selectedCategory.id
                      ? "secondary"
                      : "outline",
                })
              )}
              href={`/app/discover?category=${encodeURIComponent(category.id)}#directory-category-${category.id}`}
              key={category.id}
            >
              {category.label}
            </Link>
          ))}
        </nav>
      </section>

      <section
        aria-label="Feed directory categories"
        className="grid gap-3"
      >
        {categoryGroups.map(({ category, feeds }) => (
          <details
            className="group rounded-lg border bg-card"
            id={`directory-category-${category.id}`}
            key={category.id}
          >
            <summary className="flex cursor-pointer list-none flex-col gap-3 p-4 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden">
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <CompassIcon className="size-4" />
                </span>
                <div className="min-w-0">
                  <h2 className="font-heading text-base font-medium">
                    {category.label}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {category.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:pl-4">
                <Badge variant="secondary">
                  {feeds.length} {feeds.length === 1 ? "feed" : "feeds"}
                </Badge>
                <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
              </div>
            </summary>

            <ul className="divide-y border-t">
              {feeds.map((feed) => (
                <li
                  className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4"
                  key={feed.id}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <RssIcon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {feed.label}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {feed.source}
                      </p>
                    </div>
                  </div>

                  <div className="w-full shrink-0 sm:w-auto sm:pl-4 [&_[data-slot=button]]:w-full [&_[data-slot=button]]:min-h-9 sm:[&_[data-slot=button]]:w-auto sm:[&_[data-slot=button]]:min-h-7">
                    <FeedDirectorySubscribeButton
                      feedId={feed.id}
                      feedLabel={feed.label}
                      folders={pickerFolders}
                      subscribed={isDirectoryFeedSubscribed(
                        feed,
                        subscriptionUrls
                      )}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </section>
    </div>
  )
}

function firstSearchParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value
}

import Link from "next/link"
import { redirect } from "next/navigation"
import {
  AtomIcon,
  BriefcaseBusinessIcon,
  ChevronDownIcon,
  CompassIcon,
  CpuIcon,
  FilmIcon,
  Gamepad2Icon,
  HeartPulseIcon,
  LandmarkIcon,
  NewspaperIcon,
  RssIcon,
  TrophyIcon,
} from "lucide-react"

import { auth } from "@/auth"
import { FeedDirectorySubscribeButton } from "@/components/feed-directory-subscribe-button"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  feedDirectoryCategories,
  isDirectoryFeedSubscribed,
  listFeedDirectoryFeeds,
} from "@/lib/feed-directory"
import { listUserFeedSubscriptions } from "@/lib/feed-subscriptions"
import { listUserFolders } from "@/lib/folders"
import { cn } from "@/lib/utils"

const categoryIcons = {
  business: BriefcaseBusinessIcon,
  entertainment: FilmIcon,
  gaming: Gamepad2Icon,
  general: NewspaperIcon,
  health: HeartPulseIcon,
  politics: LandmarkIcon,
  science: AtomIcon,
  sports: TrophyIcon,
  tech: CpuIcon,
}

const categoryIconStyles = {
  business: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  entertainment: "bg-pink-50 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300",
  gaming: "bg-lime-50 text-lime-700 dark:bg-lime-950/40 dark:text-lime-300",
  general: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  health: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  politics: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  science: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  sports: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  tech: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300",
}

const countryShortcuts = [
  {
    id: "us",
    label: "US",
  },
  {
    id: "ca",
    label: "CA",
  },
  {
    id: "in",
    label: "IN",
  },
  {
    id: "gb",
    label: "GB",
  },
  {
    id: "au",
    label: "AU",
  },
] as const

function getCategoryKind(categoryId: string) {
  return categoryId.replace(/^(?:au|ca|gb|in|us)-/, "") as keyof typeof categoryIcons
}

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string | string[] }>
}) {
  void searchParams

  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
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
  const countryGroups = countryShortcuts.map((country) => ({
    ...country,
    categoryGroups: categoryGroups.filter(({ category }) =>
      category.id.startsWith(`${country.id}-`)
    ),
  }))
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
          aria-label="Nations"
          className="flex flex-wrap items-center gap-2"
        >
          {countryGroups.map((country) => (
            <Link
              className={cn(
                buttonVariants({
                  size: "sm",
                  variant: "outline",
                })
              )}
              href={`/app/discover#directory-country-${country.id}`}
              key={country.id}
            >
              {country.label}
            </Link>
          ))}
        </nav>
      </section>

      <div
        aria-label="Feed directory categories"
        className="flex flex-col gap-4"
      >
        {countryGroups.map((country) => (
          <section
            aria-label={`${country.label} feed categories`}
            className="grid scroll-mt-4 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
            id={`directory-country-${country.id}`}
            key={country.id}
          >
            {country.categoryGroups.map(({ category, feeds }) => {
              const categoryKind = getCategoryKind(category.id)
              const CategoryIcon =
                categoryIcons[categoryKind] ?? CompassIcon
              const iconStyle =
                categoryIconStyles[categoryKind] ??
                "bg-muted text-muted-foreground"

              return (
                <details
                  className="group overflow-hidden rounded-lg border bg-card shadow-xs transition-colors hover:border-foreground/15"
                  id={`directory-category-${category.id}`}
                  key={category.id}
                >
                  <summary className="flex min-h-32 cursor-pointer list-none flex-col justify-between gap-4 p-4 outline-none transition-colors hover:bg-muted/35 focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        className={cn(
                          "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md",
                          iconStyle
                        )}
                      >
                        <CategoryIcon className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <h2 className="font-heading text-base font-medium leading-6">
                          {category.label}
                        </h2>
                        <p className="text-sm leading-5 text-muted-foreground">
                          {category.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
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
              )
            })}
          </section>
        ))}
      </div>
    </div>
  )
}

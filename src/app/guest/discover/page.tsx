import Image from "next/image"
import Link from "next/link"
import { CompassIcon, RssIcon } from "lucide-react"

import { FeedDirectorySubscribeButton } from "@/components/feed-directory-subscribe-button"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  getCategoryCountryCode,
  getDiscoverDirectory,
  getNationShortcuts,
  type DiscoverDirectoryCategory,
  type DiscoverDirectoryFeed,
} from "@/lib/discover-directory"
import {
  createDiscoverInterestGroups,
  listDiscoverInterestFeeds,
  type DiscoverInterestGroup,
} from "@/lib/discover-interests"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

const GUEST_FEED_READ_ONLY_REASON = "Create an account to follow feeds."

type GuestDiscoverSearchParams = {
  interest?: string | string[]
  nation?: string | string[]
}

export default async function GuestDiscoverFeedsPage({
  searchParams,
}: {
  searchParams: Promise<GuestDiscoverSearchParams>
}) {
  const params = await searchParams
  const directory = await getDiscoverDirectory()
  const categoryGroups = directory.categories.map((category) => ({
    category,
    feeds: directory.feeds.filter((feed) => feed.categoryId === category.id),
  }))
  const totalFeedCount = categoryGroups.reduce(
    (count, group) => count + group.feeds.length,
    0
  )
  const countryGroups = getNationShortcuts(directory.categories).map(
    (country) => ({
      ...country,
      categoryGroups: categoryGroups.filter(
        ({ category }) => getCategoryCountryCode(category) === country.id
      ),
    })
  )
  const interestGroups = createDiscoverInterestGroups(directory)
  const selectedNationId = normalizeRouteId(firstSearchParam(params.nation))
  const selectedInterestId = normalizeRouteId(firstSearchParam(params.interest))
  const selectedCountry = countryGroups.find(
    (country) => country.id === selectedNationId
  )
  const selectedInterest = interestGroups.find(
    (interest) => interest.id === selectedInterestId
  )
  const interestFeeds = selectedInterest
    ? listDiscoverInterestFeeds({
        categories: directory.categories,
        feeds: directory.feeds,
        interestId: selectedInterest.id,
      })
    : []

  return (
    <div className="flex min-h-screen flex-col gap-4 p-3 sm:p-4 lg:p-6">
      <section className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <CompassIcon className="size-5 text-muted-foreground" />
            <h1 className="font-heading text-xl font-semibold">
              Discover Feeds
            </h1>
            <Badge variant="secondary">{totalFeedCount} feeds</Badge>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Browse public topics and feeds. Create an account to follow anything.
          </p>
        </div>

        <nav
          aria-label="Nations"
          className="flex max-w-full flex-wrap items-center gap-1.5 sm:justify-end"
        >
          {countryGroups.map((country) => (
            <Link
              aria-current={
                selectedCountry?.id === country.id ? "page" : undefined
              }
              className={cn(
                buttonVariants({ size: "sm", variant: "outline" }),
                "h-6 min-w-8 rounded-md px-2 text-[0.72rem] leading-none"
              )}
              href={`/guest/discover?nation=${encodeURIComponent(country.id)}`}
              key={country.id}
            >
              {country.label}
            </Link>
          ))}
        </nav>
      </section>

      {selectedCountry ? (
        <section
          aria-label={`${selectedCountry.label} feed categories`}
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
        >
          {selectedCountry.categoryGroups.map(({ category, feeds }) => (
            <CategoryCard category={category} feeds={feeds} key={category.id} />
          ))}
        </section>
      ) : selectedInterest ? (
        <InterestRecommendations
          feeds={interestFeeds}
          interest={selectedInterest}
        />
      ) : (
        <InterestPicker interests={interestGroups} />
      )}
    </div>
  )
}

function InterestPicker({
  interests,
}: {
  interests: readonly DiscoverInterestGroup[]
}) {
  return (
    <section aria-label="Discover interests" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-lg font-semibold">Choose Interests</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Pick a topic to browse available feeds.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {interests.map((interest) => (
          <Link
            aria-label={`${interest.label}, ${interest.feedCount} ${
              interest.feedCount === 1 ? "feed" : "feeds"
            }`}
            className="flex min-h-20 items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2.5 shadow-xs transition-colors hover:border-foreground/15 hover:bg-muted/30 focus-visible:ring-3 focus-visible:ring-ring/50"
            href={`/guest/discover?interest=${encodeURIComponent(
              interest.id
            )}`}
            key={interest.id}
          >
            <span className="min-w-0 truncate font-heading text-sm font-medium">
              {interest.label}
            </span>
            <Badge className="shrink-0 text-[0.7rem]" variant="secondary">
              {interest.feedCount}{" "}
              {interest.feedCount === 1 ? "feed" : "feeds"}
            </Badge>
          </Link>
        ))}
      </div>
    </section>
  )
}

function InterestRecommendations({
  feeds,
  interest,
}: {
  feeds: DiscoverDirectoryFeed[]
  interest: DiscoverInterestGroup
}) {
  return (
    <section
      aria-label={`${interest.label} feeds`}
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-heading text-lg font-semibold">
            {interest.label} feeds
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Follow buttons are disabled until you create an account.
          </p>
        </div>
        <Link
          className={buttonVariants({ size: "sm", variant: "outline" })}
          href="/guest/discover"
        >
          All topics
        </Link>
      </div>

      {feeds.length ? (
        <ul className="grid gap-3 xl:grid-cols-2">
          {feeds.map((feed) => (
            <DirectoryFeedRow feed={feed} key={feed.id} />
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          No {interest.label.toLowerCase()} feeds are available yet.
        </p>
      )}
    </section>
  )
}

function CategoryCard({
  category,
  feeds,
}: {
  category: DiscoverDirectoryCategory
  feeds: DiscoverDirectoryFeed[]
}) {
  return (
    <details className="group overflow-hidden rounded-lg border bg-card shadow-xs transition-colors hover:border-foreground/15">
      <summary className="flex min-h-24 cursor-pointer list-none flex-col justify-between gap-3 p-4 outline-none transition-colors hover:bg-muted/35 focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <h2 className="truncate font-heading text-base font-medium">
            {category.label}
          </h2>
          <Badge className="shrink-0" variant="secondary">
            {feeds.length} {feeds.length === 1 ? "feed" : "feeds"}
          </Badge>
        </div>
      </summary>

      <ul className="grid gap-2 border-t bg-muted/15 p-3">
        {feeds.map((feed) => (
          <DirectoryFeedRow feed={feed} key={feed.id} />
        ))}
      </ul>
    </details>
  )
}

function DirectoryFeedRow({ feed }: { feed: DiscoverDirectoryFeed }) {
  return (
    <li className="flex min-h-16 items-center justify-between gap-3 rounded-lg border bg-muted/35 p-3 shadow-xs transition-colors hover:bg-muted/55 dark:bg-muted/25 dark:hover:bg-muted/35">
      <div className="flex min-w-0 items-center gap-3">
        <FeedFavicon feed={feed} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-5">
            {feed.label}
          </p>
          <p className="truncate text-xs leading-4 text-muted-foreground">
            {feed.source}
          </p>
        </div>
      </div>

      <div className="shrink-0 pl-2 [&_[data-slot=button]]:min-w-20 [&_[data-slot=button]]:rounded-md">
        <FeedDirectorySubscribeButton
          feedId={feed.id}
          feedLabel={feed.label}
          folders={[]}
          readOnlyReason={GUEST_FEED_READ_ONLY_REASON}
          subscribed={false}
          subscribedLabel="Following"
          triggerIcon="plus"
          triggerLabel="Follow"
          triggerVariant="default"
        />
      </div>
    </li>
  )
}

function FeedFavicon({ feed }: { feed: DiscoverDirectoryFeed }) {
  return (
    <span className="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-background">
      <RssIcon className="absolute size-3.5 text-muted-foreground opacity-20" />
      <Image
        alt=""
        className="relative size-5 object-contain"
        height={20}
        referrerPolicy="no-referrer"
        src={getFeedFaviconUrl(feed)}
        unoptimized
        width={20}
      />
    </span>
  )
}

function getFeedFaviconUrl(
  feed: Pick<DiscoverDirectoryFeed, "source" | "url">
) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
    getFeedIconDomain(feed)
  )}&sz=64`
}

function getFeedIconDomain(feed: Pick<DiscoverDirectoryFeed, "source" | "url">) {
  return normalizeFeedIconDomain(feed.source) ?? normalizeFeedIconDomain(feed.url)
}

function normalizeFeedIconDomain(value: string) {
  const trimmed = value.trim()

  if (!trimmed) {
    return "example.com"
  }

  try {
    const parsedUrl = new URL(
      trimmed.includes("://") ? trimmed : `https://${trimmed}`
    )

    return parsedUrl.hostname.toLowerCase() || "example.com"
  } catch {
    return "example.com"
  }
}

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function normalizeRouteId(value: string | undefined) {
  return value?.trim().toLowerCase()
}

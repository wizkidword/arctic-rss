import Link from "next/link"
import Image from "next/image"
import { redirect } from "next/navigation"
import {
  AppleIcon,
  AtomIcon,
  BookOpenIcon,
  BrainCircuitIcon,
  BriefcaseBusinessIcon,
  BracesIcon,
  Building2Icon,
  CameraIcon,
  CarIcon,
  ChevronDownIcon,
  CircleDotIcon,
  ClapperboardIcon,
  Code2Icon,
  CompassIcon,
  CpuIcon,
  FilmIcon,
  FlaskConicalIcon,
  Gamepad2Icon,
  GhostIcon,
  GlobeIcon,
  Globe2Icon,
  GoalIcon,
  HammerIcon,
  HeartPulseIcon,
  HeadphonesIcon,
  HistoryIcon,
  HomeIcon,
  HospitalIcon,
  HotelIcon,
  LandmarkIcon,
  LaughIcon,
  MegaphoneIcon,
  MessagesSquareIcon,
  MusicIcon,
  NewspaperIcon,
  OrbitIcon,
  PaletteIcon,
  PanelsTopLeftIcon,
  PiggyBankIcon,
  PlaneIcon,
  RocketIcon,
  RssIcon,
  ShieldCheckIcon,
  ShirtIcon,
  SmartphoneIcon,
  SofaIcon,
  SparklesIcon,
  StoreIcon,
  TabletSmartphoneIcon,
  TelescopeIcon,
  TvIcon,
  TrophyIcon,
  UtensilsIcon,
  ZapIcon,
} from "lucide-react"

import { auth } from "@/auth"
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
import { imageProxyUrl } from "@/lib/image-proxy-url"
import {
  getDefaultDiscoverCategoryIconKey,
  type DiscoverCategoryIconKey,
} from "@/lib/discover-category-icons"
import {
  isDirectoryFeedSubscribed,
} from "@/lib/feed-directory"
import { listUserFeedSubscriptions } from "@/lib/feed-subscriptions"
import { listUserFolders } from "@/lib/folders"
import { cn } from "@/lib/utils"

const categoryIcons = {
  advertising: MegaphoneIcon,
  ai: BrainCircuitIcon,
  aliens: TelescopeIcon,
  android: SmartphoneIcon,
  "android-development": BracesIcon,
  apple: AppleIcon,
  architecture: Building2Icon,
  audio: HeadphonesIcon,
  beauty: SparklesIcon,
  biopharma: FlaskConicalIcon,
  books: BookOpenIcon,
  business: BriefcaseBusinessIcon,
  cars: CarIcon,
  comics: LaughIcon,
  cricket: CircleDotIcon,
  cybersecurity: ShieldCheckIcon,
  design: PaletteIcon,
  diy: HammerIcon,
  energy: ZapIcon,
  entertainment: FilmIcon,
  fashion: ShirtIcon,
  food: UtensilsIcon,
  football: GoalIcon,
  funny: LaughIcon,
  gaming: Gamepad2Icon,
  general: NewspaperIcon,
  health: HeartPulseIcon,
  healthcare: HospitalIcon,
  history: HistoryIcon,
  "interior-design": SofaIcon,
  "ios-development": TabletSmartphoneIcon,
  marketing: MegaphoneIcon,
  movies: ClapperboardIcon,
  music: MusicIcon,
  "personal-finance": PiggyBankIcon,
  paranormal: GhostIcon,
  photography: CameraIcon,
  politics: LandmarkIcon,
  programming: Code2Icon,
  "real-estate": HomeIcon,
  reddit: MessagesSquareIcon,
  retail: StoreIcon,
  science: AtomIcon,
  space: OrbitIcon,
  sports: TrophyIcon,
  startups: RocketIcon,
  tech: CpuIcon,
  television: TvIcon,
  tennis: CircleDotIcon,
  torrenting: RssIcon,
  travel: PlaneIcon,
  "travel-hospitality": HotelIcon,
  "ui-ux": PanelsTopLeftIcon,
  "web-development": GlobeIcon,
  world: Globe2Icon,
} satisfies Record<
  DiscoverCategoryIconKey,
  React.ComponentType<{ className?: string }>
>

const categoryIconStyles = {
  advertising: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300",
  ai: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300",
  aliens: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  android: "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300",
  "android-development": "bg-lime-50 text-lime-700 dark:bg-lime-950/40 dark:text-lime-300",
  apple: "bg-zinc-100 text-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-300",
  architecture: "bg-stone-100 text-stone-700 dark:bg-stone-900/70 dark:text-stone-300",
  audio: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300",
  beauty: "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950/40 dark:text-fuchsia-300",
  biopharma: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  books: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
  business: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  cars: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  comics: "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300",
  cricket: "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300",
  cybersecurity: "bg-slate-100 text-slate-700 dark:bg-slate-900/70 dark:text-slate-300",
  design: "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950/40 dark:text-fuchsia-300",
  diy: "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300",
  energy: "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300",
  entertainment: "bg-pink-50 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300",
  fashion: "bg-pink-50 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300",
  food: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  football: "bg-lime-50 text-lime-700 dark:bg-lime-950/40 dark:text-lime-300",
  funny: "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300",
  gaming: "bg-lime-50 text-lime-700 dark:bg-lime-950/40 dark:text-lime-300",
  general: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  health: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  healthcare: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  history: "bg-stone-100 text-stone-700 dark:bg-stone-900/70 dark:text-stone-300",
  "interior-design": "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300",
  "ios-development": "bg-slate-100 text-slate-700 dark:bg-slate-900/70 dark:text-slate-300",
  marketing: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300",
  movies: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300",
  music: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300",
  "personal-finance": "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300",
  paranormal: "bg-slate-100 text-slate-700 dark:bg-slate-900/70 dark:text-slate-300",
  photography: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  politics: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  programming: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300",
  "real-estate": "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  reddit: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
  retail: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300",
  science: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  space: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  sports: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  startups: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
  tech: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300",
  television: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  tennis: "bg-lime-50 text-lime-700 dark:bg-lime-950/40 dark:text-lime-300",
  torrenting: "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300",
  travel: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  "travel-hospitality": "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  "ui-ux": "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950/40 dark:text-fuchsia-300",
  "web-development": "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300",
  world: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
} satisfies Record<DiscoverCategoryIconKey, string>

type DiscoverSearchParams = {
  category?: string | string[]
  interest?: string | string[]
  nation?: string | string[]
}

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<DiscoverSearchParams>
}) {
  const params = await searchParams
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const [folders, subscriptions, directory] = await Promise.all([
    listUserFolders(session.user.id),
    listUserFeedSubscriptions(session.user.id),
    getDiscoverDirectory(),
  ])
  const categoryGroups = directory.categories.map((category) => ({
    category,
    feeds: directory.feeds.filter((feed) => feed.categoryId === category.id),
  }))
  const totalFeedCount = categoryGroups.reduce(
    (count, group) => count + group.feeds.length,
    0
  )
  const countryShortcuts = getNationShortcuts(directory.categories)
  const countryGroups = countryShortcuts.map((country) => ({
    ...country,
    categoryGroups: categoryGroups.filter(({ category }) =>
      getCategoryCountryCode(category) === country.id
    ),
  }))
  const interestGroups = createDiscoverInterestGroups(directory)
  const selectedNationId = normalizeRouteId(firstParamValue(params.nation))
  const selectedInterestId = normalizeRouteId(firstParamValue(params.interest))
  const selectedCountry = countryGroups.find(
    (country) => country.id === selectedNationId
  )
  const selectedInterest = interestGroups.find(
    (interest) => interest.id === selectedInterestId
  )
  const subscriptionUrls = subscriptions.map(
    (subscription) => subscription.feedUrl
  )
  const pickerFolders = folders.map(({ id, name }) => ({ id, name }))
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
            Choose topics, browse nations, and add feeds to your reader.
          </p>
        </div>

        <nav
          aria-label="Nations"
          className="flex max-w-full flex-wrap items-center gap-1.5 sm:justify-end"
        >
          {countryGroups.map((country) => (
            <Link
              className={cn(
                buttonVariants({
                  size: "sm",
                  variant: "outline",
                }),
                "h-6 min-w-8 rounded-md px-2 text-[0.72rem] leading-none"
              )}
              href={`/app/discover?nation=${encodeURIComponent(country.id)}`}
              key={country.id}
              aria-current={selectedCountry?.id === country.id ? "page" : undefined}
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
        {selectedCountry ? (
          <section
            aria-label={`${selectedCountry.label} feed categories`}
            className="grid scroll-mt-4 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
            id={`directory-country-${selectedCountry.id}`}
          >
            {selectedCountry.categoryGroups.map(({ category, feeds }) => (
              <CategoryCard
                category={category}
                feeds={feeds}
                key={category.id}
                pickerFolders={pickerFolders}
                subscriptionUrls={subscriptionUrls}
              />
            ))}
          </section>
        ) : selectedInterest ? (
          <InterestRecommendations
            feeds={interestFeeds}
            interest={selectedInterest}
            pickerFolders={pickerFolders}
            subscriptionUrls={subscriptionUrls}
          />
        ) : (
          <InterestPicker interests={interestGroups} />
        )}
      </div>
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
          <InterestCard interest={interest} key={interest.id} />
        ))}
      </div>
    </section>
  )
}

function InterestCard({
  interest,
}: {
  interest: DiscoverInterestGroup
}) {
  const InterestIcon = categoryIcons[interest.iconKey] ?? CompassIcon
  const iconStyle =
    categoryIconStyles[interest.iconKey] ?? "bg-muted text-muted-foreground"

  return (
    <Link
      aria-label={`${interest.label}, ${interest.feedCount} ${
        interest.feedCount === 1 ? "feed" : "feeds"
      }`}
      className="flex min-h-20 items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2.5 shadow-xs transition-colors hover:border-foreground/15 hover:bg-muted/30 focus-visible:ring-3 focus-visible:ring-ring/50"
      href={`/app/discover?interest=${encodeURIComponent(interest.id)}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-md",
            iconStyle
          )}
        >
          <InterestIcon className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 className="truncate font-heading text-sm font-medium leading-5">
            {interest.label}
          </h2>
        </div>
      </div>

      <div className="shrink-0">
        <Badge className="text-[0.7rem]" variant="secondary">
          {interest.feedCount} {interest.feedCount === 1 ? "feed" : "feeds"}
        </Badge>
      </div>
    </Link>
  )
}

function InterestRecommendations({
  feeds,
  interest,
  pickerFolders,
  subscriptionUrls,
}: {
  feeds: DiscoverDirectoryFeed[]
  interest: DiscoverInterestGroup
  pickerFolders: Array<{ id: string; name: string }>
  subscriptionUrls: string[]
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
            All feeds available in this topic.
          </p>
        </div>
        <Link
          className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
          href="/app/discover"
        >
          All topics
        </Link>
      </div>

      {feeds.length ? (
        <ul className="grid gap-3 xl:grid-cols-2">
          {feeds.map((feed) => (
            <DirectoryFeedRow
              feed={feed}
              key={feed.id}
              pickerFolders={pickerFolders}
              subscriptionUrls={subscriptionUrls}
            />
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
  pickerFolders,
  subscriptionUrls,
}: {
  category: DiscoverDirectoryCategory
  feeds: DiscoverDirectoryFeed[]
  pickerFolders: Array<{ id: string; name: string }>
  subscriptionUrls: string[]
}) {
  const categoryKind =
    category.iconKey ?? getDefaultDiscoverCategoryIconKey(category.id)
  const CategoryIcon = categoryIcons[categoryKind] ?? CompassIcon
  const iconStyle =
    categoryIconStyles[categoryKind] ?? "bg-muted text-muted-foreground"

  return (
    <details
      className="group overflow-hidden rounded-lg border bg-card shadow-xs transition-colors hover:border-foreground/15"
      id={`directory-category-${category.id}`}
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

      <ul className="grid gap-2 border-t bg-muted/15 p-3">
        {feeds.map((feed) => (
          <DirectoryFeedRow
            className="shadow-none"
            feed={feed}
            key={feed.id}
            pickerFolders={pickerFolders}
            subscriptionUrls={subscriptionUrls}
          />
        ))}
      </ul>
    </details>
  )
}

function DirectoryFeedRow({
  className,
  feed,
  pickerFolders,
  subscriptionUrls,
}: {
  className?: string
  feed: DiscoverDirectoryFeed
  pickerFolders: Array<{ id: string; name: string }>
  subscriptionUrls: string[]
}) {
  return (
    <li
      className={cn(
        "flex min-h-16 items-center justify-between gap-3 rounded-lg border bg-muted/35 p-3 shadow-xs transition-colors hover:bg-muted/55 dark:bg-muted/25 dark:hover:bg-muted/35",
        className
      )}
    >
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
          folders={pickerFolders}
          subscribed={isDirectoryFeedSubscribed(feed, subscriptionUrls)}
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
  const remoteFaviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
    getFeedIconDomain(feed)
  )}&sz=64`

  return imageProxyUrl(remoteFaviconUrl) ?? "/favicon.ico"
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
    const parsedUrl = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`)

    return parsedUrl.hostname.toLowerCase() || "example.com"
  } catch {
    return "example.com"
  }
}

function firstParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function normalizeRouteId(value: string | undefined) {
  return value?.trim().toLowerCase()
}

import type { SVGProps } from "react"
import Link from "next/link"
import {
  BookmarkIcon,
  CompassIcon,
  DownloadIcon,
  FolderIcon,
  HeadphonesIcon,
  HomeIcon,
  InboxIcon,
  MessageCircleIcon,
  RssIcon,
  SearchIcon,
  SettingsIcon,
  SparklesIcon,
  StarIcon,
} from "lucide-react"

import { AddFeedSheet } from "@/components/add-feed-sheet"
import { AppShellHelpMenu } from "@/components/app-shell-help-menu"
import { ReaderNavigationLink } from "@/components/reader/navigation-link"
import { buttonVariants } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

export type ShellFeedSubscription = {
  faviconUrl: string | null
  feedId: string
  folderId: string | null
  folderName: string | null
  id: string
  isPaused: boolean
  lastError: string | null
  lastSuccessfulFetchAt: Date | null
  siteUrl: string | null
  title: string
  unreadCount: number
}

export type ShellReaderCounts = {
  allCount: number
  starredCount: number
  unreadCount: number
}

export type ShellFolder = {
  id: string
  name: string
  subscriptionCount: number
  unreadCount: number
}

export type ShellArticleCollection = {
  articleCount: number
  id: string
  name: string
}

export type ShellDiscoverInterest = {
  feedCount: number
  id: string
  label: string
}

type ShellNavigationItem = {
  count: number
  href: string
  icon: typeof HomeIcon
  label: string
}

const secondaryNav = [
  {
    href: "/app/settings/import-export",
    icon: DownloadIcon,
    label: "Import/Export",
  },
  { href: "/app/settings", label: "Settings", icon: SettingsIcon },
]

const kofiHref = "https://ko-fi.com/arcticrss"

function KofiIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      {...props}
    >
      <path
        d="M4.5 6h12.25a3 3 0 0 1 3 3v.25h.5a2.75 2.75 0 0 1 0 5.5h-.85A6 6 0 0 1 13.75 19H8a6 6 0 0 1-6-6V8.5A2.5 2.5 0 0 1 4.5 6Z"
        fill="#29abe0"
      />
      <path
        d="M19.75 11h.5a1 1 0 0 1 0 2h-.5v-2Z"
        fill="#ffffff"
        opacity="0.95"
      />
      <path
        d="M10.75 15.2 7.5 12.1a2.05 2.05 0 0 1 2.85-2.95l.4.38.4-.38A2.05 2.05 0 0 1 14 12.1l-3.25 3.1Z"
        fill="#ff5f5f"
      />
    </svg>
  )
}

function NavigationGroup({
  items,
  label,
}: {
  items: ShellNavigationItem[]
  label: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="px-2 pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {items.map((item) => (
        <ReaderNavigationLink
          exact={item.href === "/app" || item.href === "/guest"}
          key={item.href}
          href={item.href}
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "h-8 justify-start gap-2 px-2 text-muted-foreground"
          )}
        >
          <item.icon data-icon="inline-start" />
          <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
          <span className="text-xs tabular-nums">{item.count}</span>
        </ReaderNavigationLink>
      ))}
    </div>
  )
}

function FeedNavLink({ subscription }: { subscription: ShellFeedSubscription }) {
  return (
    <Link
      aria-haspopup="menu"
      className={cn(
        buttonVariants({ variant: "ghost" }),
        "h-8 justify-start gap-2 px-2 text-muted-foreground"
      )}
      data-feed-nav-subscription-id={subscription.id}
      href={`/app/feed/${subscription.id}`}
    >
      <RssIcon data-icon="inline-start" />
      <span className="min-w-0 flex-1 truncate text-left">
        {subscription.title}
      </span>
      {subscription.unreadCount > 0 && (
        <span className="text-xs tabular-nums">{subscription.unreadCount}</span>
      )}
      {subscription.isPaused ? (
        <span className="text-xs text-muted-foreground">Paused</span>
      ) : subscription.lastError ? (
        <span
          aria-label="Feed needs attention"
          className="size-1.5 rounded-full bg-destructive"
        />
      ) : null}
    </Link>
  )
}

export function ReaderNav({
  articleCollections,
  chatEnabled = false,
  discoverInterests,
  feedSubscriptions,
  folders,
  guestMode = false,
  readerCounts,
}: {
  articleCollections: ShellArticleCollection[]
  chatEnabled?: boolean
  discoverInterests: ShellDiscoverInterest[]
  feedSubscriptions: ShellFeedSubscription[]
  folders: ShellFolder[]
  guestMode?: boolean
  readerCounts: ShellReaderCounts
}) {
  const appBasePath = guestMode ? "/guest" : "/app"
  const discoverFeedsHref = `${appBasePath}/discover`
  const discoverPodcastsHref = guestMode
    ? "/guest/podcasts/discover"
    : "/app/podcasts/discover"
  const readerNav: ShellNavigationItem[] = guestMode
    ? [
        {
          count: readerCounts.allCount,
          href: "/guest",
          icon: HomeIcon,
          label: "All Articles",
        },
      ]
    : [
        {
          count: readerCounts.allCount,
          href: "/app",
          icon: HomeIcon,
          label: "All Articles",
        },
        {
          count: readerCounts.unreadCount,
          href: "/app/unread",
          icon: InboxIcon,
          label: "Unread",
        },
        {
          count: readerCounts.starredCount,
          href: "/app/starred",
          icon: StarIcon,
          label: "Starred",
        },
      ]
  const briefingsNav: ShellNavigationItem[] = guestMode
    ? []
    : [
        {
          count: 0,
          href: "/app/search",
          icon: SearchIcon,
          label: "Search",
        },
        {
          count: 0,
          href: "/app/saved-searches",
          icon: BookmarkIcon,
          label: "Saved views",
        },
        {
          count: 0,
          href: "/app/ai",
          label: "AI summaries",
          icon: SparklesIcon,
        },
        {
          count: 0,
          href: "/app/smart-digests",
          label: "Smart digests",
          icon: SparklesIcon,
        },
      ]
  const listenNav: ShellNavigationItem[] = [
    {
      count: 0,
      href: guestMode ? "/guest/podcasts/discover" : "/app/podcasts",
      label: "Podcasts",
      icon: HeadphonesIcon,
    },
  ]
  const communityNav: ShellNavigationItem[] = chatEnabled && !guestMode
    ? [
        {
          count: 0,
          href: "/irc",
          label: "Arctic IRC",
          icon: MessageCircleIcon,
        },
      ]
    : []

  return (
    <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1">
      <NavigationGroup items={readerNav} label="Read" />
      <Separator className="my-2" />
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 px-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Feeds
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {feedSubscriptions.length}
          </span>
        </div>
        {!guestMode && (
          <AddFeedSheet folders={folders.map(({ id, name }) => ({ id, name }))} />
        )}
        <Link
          href={discoverFeedsHref}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "h-7 justify-start gap-2 px-2"
          )}
        >
          <CompassIcon data-icon="inline-start" />
          <span className="min-w-0 flex-1 truncate text-left">Discover Feeds</span>
        </Link>
        <div className="flex max-h-72 flex-col gap-1 overflow-y-auto pr-1">
          {!guestMode && feedSubscriptions.length ? (
            feedSubscriptions.map((subscription) => (
              <FeedNavLink key={subscription.id} subscription={subscription} />
            ))
          ) : (
            <p className="px-2 py-1 text-xs leading-5 text-muted-foreground">
              {guestMode
                ? "Browse Discover to preview public feeds."
                : "Add your first feed to start filling the reader."}
            </p>
          )}
        </div>
      </div>
      {discoverInterests.length ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 px-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Topics
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {discoverInterests.length}
            </span>
          </div>
          <div className="flex max-h-40 flex-col gap-1 overflow-y-auto pl-3 pr-1">
            {discoverInterests.map((interest) => (
              <Link
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "h-7 justify-start gap-2 px-2 text-muted-foreground"
                )}
                href={`${discoverFeedsHref}?interest=${interest.id}`}
                key={interest.id}
              >
                <span className="min-w-0 flex-1 truncate text-left">
                  {interest.label}
                </span>
                <span className="text-xs tabular-nums">{interest.feedCount}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
      <Separator className="my-2" />
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 px-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Folders
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {folders.length}
          </span>
        </div>
        {!guestMode && (
          <Link
            href="/app/folders"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "h-7 justify-start gap-2 px-2"
            )}
          >
            <FolderIcon data-icon="inline-start" />
            <span className="min-w-0 flex-1 truncate text-left">Manage folders</span>
          </Link>
        )}
        {guestMode ? (
          <p className="px-2 py-1 text-xs leading-5 text-muted-foreground">
            Folders unlock after you create an account.
          </p>
        ) : null}
        <div className="flex max-h-44 flex-col gap-1 overflow-y-auto pr-1">
          {!guestMode && folders.length ? (
            folders.map((folder) => (
              <Link
                key={folder.id}
                href={`/app/folder/${folder.id}`}
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "h-8 justify-start gap-2 px-2 text-muted-foreground"
                )}
              >
                <FolderIcon data-icon="inline-start" />
                <span className="min-w-0 flex-1 truncate text-left">{folder.name}</span>
                {folder.unreadCount > 0 && (
                  <span className="text-xs tabular-nums">{folder.unreadCount}</span>
                )}
              </Link>
            ))
          ) : !guestMode ? (
            <p className="px-2 py-1 text-xs leading-5 text-muted-foreground">
              Group feeds as your list grows.
            </p>
          ) : null}
        </div>
      </div>
      <Separator className="my-2" />
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 px-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Collections
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {articleCollections.length}
          </span>
        </div>
        {!guestMode && (
          <Link
            href="/app/collections"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "h-7 justify-start gap-2 px-2"
            )}
          >
            <BookmarkIcon data-icon="inline-start" />
            <span className="min-w-0 flex-1 truncate text-left">All collections</span>
          </Link>
        )}
        {guestMode ? (
          <p className="px-2 py-1 text-xs leading-5 text-muted-foreground">
            Create an account to save articles and episodes.
          </p>
        ) : null}
        <div className="flex max-h-40 flex-col gap-1 overflow-y-auto pr-1">
          {!guestMode && articleCollections.length ? (
            articleCollections.map((collection) => (
              <Link
                key={collection.id}
                href={`/app/collections/${collection.id}`}
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "h-8 justify-start gap-2 px-2 text-muted-foreground"
                )}
              >
                <BookmarkIcon data-icon="inline-start" />
                <span className="min-w-0 flex-1 truncate text-left">{collection.name}</span>
                {collection.articleCount > 0 && (
                  <span className="text-xs tabular-nums">{collection.articleCount}</span>
                )}
              </Link>
            ))
          ) : !guestMode ? (
            <p className="px-2 py-1 text-xs leading-5 text-muted-foreground">
              Save articles or podcast episodes for later.
            </p>
          ) : null}
        </div>
      </div>
      <Separator className="my-2" />
      {briefingsNav.length ? (
        <>
          <NavigationGroup items={briefingsNav} label="Briefings & Rules" />
          <Separator className="my-2" />
        </>
      ) : null}
      <NavigationGroup items={listenNav} label="Listen" />
      <Link
        href={discoverPodcastsHref}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "mt-2 h-7 justify-start gap-2 px-2"
        )}
      >
        <CompassIcon data-icon="inline-start" />
        <span className="min-w-0 flex-1 truncate text-left">Discover Podcasts</span>
      </Link>
      {communityNav.length ? (
        <>
          <Separator className="my-2" />
          <NavigationGroup items={communityNav} label="Community" />
        </>
      ) : null}
      <Separator className="my-2" />
      {!guestMode &&
        secondaryNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "h-8 justify-start gap-2 px-2 text-muted-foreground"
            )}
          >
            <item.icon data-icon="inline-start" />
            <span className="truncate">{item.label}</span>
          </Link>
        ))}
      <AppShellHelpMenu />
      <a
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "h-8 justify-start gap-2 px-2"
        )}
        href={kofiHref}
        rel="noreferrer"
        target="_blank"
      >
        <KofiIcon className="size-4 shrink-0" data-icon="inline-start" />
        <span className="min-w-0 flex-1 truncate text-left">Support this project</span>
      </a>
    </nav>
  )
}

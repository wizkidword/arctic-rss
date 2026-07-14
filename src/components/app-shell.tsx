"use client"

import { ReactNode, SVGProps, useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { signOut } from "next-auth/react"
import {
  BookmarkIcon,
  BugIcon,
  CompassIcon,
  DownloadIcon,
  FileTextIcon,
  FolderIcon,
  HeadphonesIcon,
  HelpCircleIcon,
  HomeIcon,
  InboxIcon,
  LightbulbIcon,
  LogOutIcon,
  MailIcon,
  MenuIcon,
  MessageCircleIcon,
  SettingsIcon,
  SparklesIcon,
  StarIcon,
} from "lucide-react"

import { AddFeedSheet } from "@/components/add-feed-sheet"
import { AdminAccountLink } from "@/components/admin-account-link"
import { BugReportDialog } from "@/components/bug-report-dialog"
import { BulkReadProgress } from "@/components/bulk-read-progress"
import { EmailVerificationReminder } from "@/components/email-verification-reminder"
import { FeedNavContextMenu } from "@/components/feed-nav-context-menu"
import { FeatureSuggestionDialog } from "@/components/feature-suggestion-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import type { ThemePreference } from "@/lib/settings"
import type { DisplayMode } from "@/lib/settings"
import type { BulkReadJobProgress } from "@/lib/bulk-read-jobs"
import { legalLinks } from "@/lib/legal-links"
import { isDarkThemePreference } from "@/lib/settings"
import {
  applyThemePreferenceToDocument,
  subscribeToSystemThemeChanges,
} from "@/lib/theme-dom"
import { cn } from "@/lib/utils"

type ShellUser = {
  email?: string | null
  name?: string | null
  role?: string | null
}

type ShellFeedSubscription = {
  faviconUrl: string | null
  feedId: string
  folderId: string | null
  folderName: string | null
  id: string
  isPaused: boolean
  lastError: string | null
  siteUrl: string | null
  title: string
  unreadCount: number
}

type ShellReaderCounts = {
  allCount: number
  starredCount: number
  unreadCount: number
}

type ShellFolder = {
  id: string
  name: string
  subscriptionCount: number
  unreadCount: number
}

type ShellArticleCollection = {
  articleCount: number
  id: string
  name: string
}

type ShellDiscoverInterest = {
  feedCount: number
  id: string
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

const supportEmailAddress = "support@arcticrss.com"
const supportMailtoHref = `mailto:${supportEmailAddress}?subject=Arctic%20RSS%20Support`
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

function initialsFor(user: ShellUser) {
  const source = user.name || user.email || "AR"

  return source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

function HelpMenu() {
  const [bugReportOpen, setBugReportOpen] = useState(false)
  const [featureSuggestionOpen, setFeatureSuggestionOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "h-8 w-full justify-start gap-2 px-2 text-muted-foreground"
              )}
              type="button"
              variant="ghost"
            />
          }
        >
          <HelpCircleIcon data-icon="inline-start" />
          <span className="truncate">Help</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Help</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setBugReportOpen(true)}>
              <BugIcon data-icon="inline-start" />
              Report a bug
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFeatureSuggestionOpen(true)}>
              <LightbulbIcon data-icon="inline-start" />
              Suggest a feature
            </DropdownMenuItem>
            <DropdownMenuItem
              render={
                <a
                  href={supportMailtoHref}
                  rel="noreferrer"
                  target="_blank"
                />
              }
            >
              <MailIcon data-icon="inline-start" />
              Contact support
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {legalLinks.map((item) => (
              <DropdownMenuItem
                key={item.href}
                render={<Link href={item.href} />}
              >
                <FileTextIcon data-icon="inline-start" />
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <BugReportDialog
        onOpenChange={setBugReportOpen}
        open={bugReportOpen}
      />
      <FeatureSuggestionDialog
        onOpenChange={setFeatureSuggestionOpen}
        open={featureSuggestionOpen}
      />
    </>
  )
}

function ReaderNav({
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
  const primaryNav = guestMode
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
        {
          count: 0,
          href: "/app/ai",
          label: "AI Summaries",
          icon: SparklesIcon,
        },
        {
          count: 0,
          href: "/app/smart-digests",
          label: "Smart Digests",
          icon: SparklesIcon,
        },
        {
          count: 0,
          href: "/app/podcasts",
          label: "Podcasts",
          icon: HeadphonesIcon,
        },
        ...(chatEnabled
          ? [
              {
                count: 0,
                href: "/irc",
                label: "Chat",
                icon: MessageCircleIcon,
              },
            ]
          : []),
      ]

  return (
    <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1">
      {primaryNav.map((item) => (
        <Link
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
        </Link>
      ))}
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
        {!guestMode && <AddFeedSheet folders={folders} />}
        <Link
          href={discoverFeedsHref}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "h-7 justify-start gap-2 px-2"
          )}
        >
          <CompassIcon data-icon="inline-start" />
          <span className="min-w-0 flex-1 truncate text-left">
            Discover Feeds
          </span>
        </Link>
        <div className="flex max-h-72 flex-col gap-1 overflow-y-auto pr-1">
          {!guestMode && feedSubscriptions.length ? (
            feedSubscriptions.map((subscription) => (
              <FeedNavContextMenu
                key={subscription.id}
                subscription={subscription}
              />
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
      <Link
        href={discoverPodcastsHref}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "mt-2 h-7 justify-start gap-2 px-2"
        )}
      >
        <CompassIcon data-icon="inline-start" />
        <span className="min-w-0 flex-1 truncate text-left">
          Discover Podcasts
        </span>
      </Link>
      <Separator className="my-2" />
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
                <span className="text-xs tabular-nums">
                  {interest.feedCount}
                </span>
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
            <span className="min-w-0 flex-1 truncate text-left">
              Manage folders
            </span>
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
                <span className="min-w-0 flex-1 truncate text-left">
                  {folder.name}
                </span>
                {folder.unreadCount > 0 && (
                  <span className="text-xs tabular-nums">
                    {folder.unreadCount}
                  </span>
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
            <span className="min-w-0 flex-1 truncate text-left">
              All collections
            </span>
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
                <span className="min-w-0 flex-1 truncate text-left">
                  {collection.name}
                </span>
                {collection.articleCount > 0 && (
                  <span className="text-xs tabular-nums">
                    {collection.articleCount}
                  </span>
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
      <HelpMenu />
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
        <span className="min-w-0 flex-1 truncate text-left">
          Support this project
        </span>
      </a>
    </nav>
  )
}

function AccountMenu({
  compact = false,
  user,
}: {
  compact?: boolean
  user: ShellUser
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={
              compact
                ? `Account menu for ${user.name || user.email || "reader"}`
                : undefined
            }
            className="h-auto min-w-0 justify-start p-2"
            variant="ghost"
          />
        }
      >
        <Avatar size="sm">
          <AvatarFallback>{initialsFor(user)}</AvatarFallback>
        </Avatar>
        {!compact && (
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-sm font-medium">
              {user.name || "Arctic Reader"}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {user.email}
            </span>
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Account</DropdownMenuLabel>
          <DropdownMenuItem>{user.role === "ADMIN" ? "Admin" : "Reader"}</DropdownMenuItem>
          <AdminAccountLink role={user.role} />
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/" })}>
            <LogOutIcon data-icon="inline-start" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function GuestAccountMenu({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-lg px-2 py-2",
        compact ? "justify-end" : "bg-muted/40"
      )}
    >
      {!compact && (
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            Browsing as guest
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            Read-only preview
          </span>
        </span>
      )}
      <Link
        className={cn(buttonVariants({ size: "sm" }), "h-8 shrink-0")}
        href="/signup"
      >
        Create account
      </Link>
    </div>
  )
}

export function AppShell({
  articleCollections,
  bulkReadJob,
  chatEnabled = false,
  children,
  discoverInterests,
  displayMode,
  feedSubscriptions,
  folders,
  guestMode = false,
  readerCounts,
  showEmailVerificationReminder = false,
  themePreference,
  user,
}: {
  articleCollections: ShellArticleCollection[]
  bulkReadJob?: BulkReadJobProgress | null
  chatEnabled?: boolean
  children: ReactNode
  discoverInterests: ShellDiscoverInterest[]
  displayMode: DisplayMode
  feedSubscriptions: ShellFeedSubscription[]
  folders: ShellFolder[]
  guestMode?: boolean
  readerCounts: ShellReaderCounts
  showEmailVerificationReminder?: boolean
  themePreference: ThemePreference
  user: ShellUser
}) {
  const isMinimal = displayMode === "MINIMAL"
  const homeHref = guestMode ? "/guest" : "/app"
  const isStaticDarkTheme =
    themePreference !== "SYSTEM" && isDarkThemePreference(themePreference)

  return (
    <div
      className={cn(
        isStaticDarkTheme && "dark",
        "min-h-screen bg-background text-foreground"
      )}
      data-display-mode={displayMode.toLowerCase().replace("_", "-")}
      data-reader-theme={themePreference.toLowerCase()}
      data-theme-preference={themePreference.toLowerCase()}
    >
      <ThemeController themePreference={themePreference} />
      {!isMinimal && (
        <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-sidebar p-3 lg:flex lg:flex-col">
          <Link href={homeHref} className="mb-4 flex items-center gap-2 px-2 py-1.5">
            <span className="flex size-8 items-center justify-center overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-border">
              <Image
                alt=""
                aria-hidden="true"
                height={32}
                src="/brand/arctic-rss-icon.png"
                unoptimized
                width={32}
              />
            </span>
            <span className="font-heading text-base font-semibold">Arctic RSS</span>
          </Link>
          <ReaderNav
            articleCollections={articleCollections}
            chatEnabled={chatEnabled}
            discoverInterests={discoverInterests}
            feedSubscriptions={feedSubscriptions}
            folders={folders}
            guestMode={guestMode}
            readerCounts={readerCounts}
          />
          <div className="mt-auto">
            {guestMode ? <GuestAccountMenu /> : <AccountMenu user={user} />}
          </div>
        </aside>
      )}

      <header
        className={cn(
          "sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/95 px-3 backdrop-blur",
          !isMinimal && "lg:hidden"
        )}
      >
        <Sheet>
          <SheetTrigger render={<Button variant="ghost" size="icon" />}>
            <MenuIcon />
            <span className="sr-only">Open navigation</span>
          </SheetTrigger>
          <SheetContent side="left">
            <SheetHeader>
              <SheetTitle>Arctic RSS</SheetTitle>
            </SheetHeader>
            <div className="px-4">
              <ReaderNav
                articleCollections={articleCollections}
                chatEnabled={chatEnabled}
                discoverInterests={discoverInterests}
                feedSubscriptions={feedSubscriptions}
                folders={folders}
                guestMode={guestMode}
                readerCounts={readerCounts}
              />
            </div>
          </SheetContent>
        </Sheet>
        <Link href={homeHref} className="font-heading font-semibold">
          Arctic RSS
        </Link>
        <div className="ml-auto">
          {guestMode ? (
            <GuestAccountMenu compact />
          ) : (
            <AccountMenu compact user={user} />
          )}
        </div>
      </header>

      <main className={cn(!isMinimal && "lg:pl-64")}>
        {guestMode ? (
          <div className="border-b bg-sky-50 px-3 py-3 text-sky-950 dark:bg-sky-950/30 dark:text-sky-100 sm:px-5 lg:px-6">
            <div className="mx-auto flex max-w-[1600px] flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p>
                <span className="font-medium">Browsing as guest.</span>{" "}
                You can explore public feeds and podcasts, but saving,
                starring, subscribing, and AI tools require an account.
              </p>
              <div className="flex gap-2">
                <Link className={buttonVariants({ size: "sm" })} href="/signup">
                  Create account
                </Link>
                <Link
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                  href="/login"
                >
                  Log in
                </Link>
              </div>
            </div>
          </div>
        ) : null}
        {showEmailVerificationReminder ? (
          <div className="border-b bg-muted/30 px-3 py-3 sm:px-5 lg:px-6">
            <EmailVerificationReminder className="mx-auto max-w-[1600px]" />
          </div>
        ) : null}
        {bulkReadJob ? <BulkReadProgress job={bulkReadJob} /> : null}
        {children}
      </main>
    </div>
  )
}

function ThemeController({
  themePreference,
}: {
  themePreference: ThemePreference
}) {
  useEffect(() => {
    applyThemePreferenceToDocument(themePreference)

    if (themePreference !== "SYSTEM") {
      return
    }

    return subscribeToSystemThemeChanges(() => {
      applyThemePreferenceToDocument(themePreference)
    })
  }, [themePreference])

  return null
}

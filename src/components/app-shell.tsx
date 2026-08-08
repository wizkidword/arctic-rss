import type { ReactNode } from "react"
import Image from "next/image"
import Link from "next/link"

import {
  AppShellAccountMenu,
  type ShellAccountUser,
} from "@/components/app-shell-account-menu"
import { AppShellThemeController } from "@/components/app-shell-theme-controller"
import { BulkReadProgress } from "@/components/bulk-read-progress"
import { EmailVerificationReminder } from "@/components/email-verification-reminder"
import { FeedNavMenuController } from "@/components/feed-nav-context-menu"
import { MobileReaderNavigation } from "@/components/mobile-reader-navigation"
import {
  ReaderNav,
  type ShellArticleCollection,
  type ShellDiscoverInterest,
  type ShellFeedSubscription,
  type ShellFolder,
  type ShellReaderCounts,
} from "@/components/reader-navigation"
import { buttonVariants } from "@/components/ui/button"
import type { BulkReadJobProgress } from "@/lib/bulk-read-jobs"
import {
  isDarkThemePreference,
  type DisplayMode,
  type ThemePreference,
} from "@/lib/settings"
import { cn } from "@/lib/utils"

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
  user: ShellAccountUser
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
      <AppShellThemeController themePreference={themePreference} />
      {!guestMode && feedSubscriptions.length ? (
        <FeedNavMenuController subscriptions={feedSubscriptions} />
      ) : null}
      {!isMinimal && (
        <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-sidebar p-3 lg:flex lg:flex-col">
          <Link
            href={homeHref}
            className="mb-4 flex items-center gap-2 px-2 py-1.5"
          >
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
            {guestMode ? (
              <GuestAccountMenu />
            ) : (
              <AppShellAccountMenu user={user} />
            )}
          </div>
        </aside>
      )}

      <header
        className={cn(
          "sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/95 px-3 backdrop-blur",
          !isMinimal && "lg:hidden"
        )}
      >
        <MobileReaderNavigation
          articleCollections={articleCollections}
          chatEnabled={chatEnabled}
          discoverInterests={discoverInterests}
          feedSubscriptions={feedSubscriptions}
          folders={folders}
          guestMode={guestMode}
          readerCounts={readerCounts}
        />
        <Link href={homeHref} className="font-heading font-semibold">
          Arctic RSS
        </Link>
        <div className="ml-auto">
          {guestMode ? (
            <GuestAccountMenu compact />
          ) : (
            <AppShellAccountMenu compact user={user} />
          )}
        </div>
      </header>

      <main className={cn(!isMinimal && "lg:pl-64")}>
        {guestMode ? (
          <div className="border-b bg-sky-50 px-3 py-3 text-sky-950 dark:bg-sky-950/30 dark:text-sky-100 sm:px-5 lg:px-6">
            <div className="mx-auto flex max-w-[1600px] flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p>
                <span className="font-medium">Browsing as guest.</span>{" "}
                You can explore public feeds and podcasts, but saving, starring,
                subscribing, and AI tools require an account.
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

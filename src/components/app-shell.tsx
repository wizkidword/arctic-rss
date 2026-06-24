"use client"

import { ReactNode } from "react"
import Link from "next/link"
import { signOut } from "next-auth/react"
import {
  BotIcon,
  DownloadIcon,
  FolderIcon,
  HomeIcon,
  InboxIcon,
  LogOutIcon,
  MenuIcon,
  RssIcon,
  SettingsIcon,
  SparklesIcon,
  StarIcon,
} from "lucide-react"

import { AddFeedSheet } from "@/components/add-feed-sheet"
import { AdminAccountLink } from "@/components/admin-account-link"
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

const secondaryNav = [
  {
    href: "/app/settings/import-export",
    icon: DownloadIcon,
    label: "Import/Export",
  },
  { href: "/app/settings", label: "Settings", icon: SettingsIcon },
]

function initialsFor(user: ShellUser) {
  const source = user.name || user.email || "AR"

  return source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

function ReaderNav({
  feedSubscriptions,
  folders,
  readerCounts,
}: {
  feedSubscriptions: ShellFeedSubscription[]
  folders: ShellFolder[]
  readerCounts: ShellReaderCounts
}) {
  const primaryNav = [
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
    { count: 0, href: "/app/ai", label: "AI Summaries", icon: SparklesIcon },
  ]

  return (
    <nav className="flex flex-col gap-1">
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
      {secondaryNav.map((item) => (
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
        <div className="flex max-h-44 flex-col gap-1 overflow-y-auto pr-1">
          {folders.length ? (
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
          ) : (
            <p className="px-2 py-1 text-xs leading-5 text-muted-foreground">
              Group feeds as your list grows.
            </p>
          )}
        </div>
      </div>
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
        <AddFeedSheet folders={folders} />
        <div className="flex max-h-72 flex-col gap-1 overflow-y-auto pr-1">
          {feedSubscriptions.length ? (
            feedSubscriptions.map((subscription) => (
              <Link
                key={subscription.id}
                href={`/app/feed/${subscription.id}`}
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "h-8 justify-start gap-2 px-2 text-muted-foreground"
                )}
              >
                <RssIcon data-icon="inline-start" />
                <span className="min-w-0 flex-1 truncate text-left">
                  {subscription.title}
                </span>
                {subscription.unreadCount > 0 && (
                  <span className="text-xs tabular-nums">
                    {subscription.unreadCount}
                  </span>
                )}
                {subscription.lastError && (
                  <span className="size-1.5 rounded-full bg-destructive" />
                )}
              </Link>
            ))
          ) : (
            <p className="px-2 py-1 text-xs leading-5 text-muted-foreground">
              Add your first feed to start filling the reader.
            </p>
          )}
        </div>
      </div>
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

export function AppShell({
  children,
  feedSubscriptions,
  folders,
  readerCounts,
  user,
}: {
  children: ReactNode
  feedSubscriptions: ShellFeedSubscription[]
  folders: ShellFolder[]
  readerCounts: ShellReaderCounts
  user: ShellUser
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-sidebar p-3 lg:flex lg:flex-col">
        <Link href="/app" className="mb-4 flex items-center gap-2 px-2 py-1.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BotIcon />
          </span>
          <span className="font-heading text-base font-semibold">Arctic RSS</span>
        </Link>
        <ReaderNav
          feedSubscriptions={feedSubscriptions}
          folders={folders}
          readerCounts={readerCounts}
        />
        <div className="mt-auto">
          <AccountMenu user={user} />
        </div>
      </aside>

      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/95 px-3 backdrop-blur lg:hidden">
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
                feedSubscriptions={feedSubscriptions}
                folders={folders}
                readerCounts={readerCounts}
              />
            </div>
          </SheetContent>
        </Sheet>
        <Link href="/app" className="font-heading font-semibold">
          Arctic RSS
        </Link>
        <div className="ml-auto">
          <AccountMenu compact user={user} />
        </div>
      </header>

      <main className="lg:pl-64">{children}</main>
    </div>
  )
}

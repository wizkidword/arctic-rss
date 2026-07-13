import Link from "next/link"
import { notFound, redirect } from "next/navigation"

import { auth } from "@/auth"
import { ReaderSurface } from "@/components/reader-surface"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { listArticleCollectionsForUser } from "@/lib/article-collections"
import { listReaderArticlePage } from "@/lib/articles"
import {
  listUserFeedSubscriptions,
  type FeedSubscriptionNavItem,
} from "@/lib/feed-subscriptions"
import { getUserFolder } from "@/lib/folders"
import { normalizeDefaultView } from "@/lib/preferences"
import { normalizeDateTimePreferences, normalizeDisplayMode } from "@/lib/settings"
import { getOrCreateUserSettings } from "@/lib/user-settings"

export default async function FolderPage({
  params,
  searchParams,
}: {
  params: Promise<{ folderId: string }>
  searchParams: Promise<{ after?: string | string[]; articleId?: string | string[] }>
}) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const { folderId } = await params
  const query = await searchParams
  const [
    folder,
    settings,
    articlePage,
    articleCollections,
    subscriptions,
  ] = await Promise.all([
    getUserFolder(session.user.id, folderId),
    getOrCreateUserSettings(session.user.id),
    listReaderArticlePage({
      after: firstSearchParam(query.after),
      folderId,
      userId: session.user.id,
    }),
    listArticleCollectionsForUser(session.user.id),
    listUserFeedSubscriptions(session.user.id),
  ])

  if (!folder) {
    notFound()
  }

  const folderSubscriptions = subscriptions.filter(
    (subscription) => subscription.folderId === folder.id
  )

  return (
    <ReaderSurface
      articles={articlePage.articles}
      articleCollections={articleCollections}
      basePath={`/app/folder/${folder.id}`}
      dateTimePreferences={normalizeDateTimePreferences(settings)}
      defaultView={normalizeDefaultView(settings.defaultView)}
      displayMode={normalizeDisplayMode(settings.displayMode)}
      description={`${folder.subscriptionCount} ${
        folder.subscriptionCount === 1 ? "feed" : "feeds"
      } in this folder.`}
      emptyMessage="This folder has no stored articles yet. Move feeds into it or refresh its feeds."
      markAllReadScope={{ folderId: folder.id, type: "folder" }}
      nextPageHref={nextPageHref(
        `/app/folder/${folder.id}`,
        articlePage.nextCursor
      )}
      selectedArticleId={firstSearchParam(query.articleId)}
      title={folder.name}
      toolbar={
        <>
          <FolderFeedBrowser
            feeds={folderSubscriptions}
            folderId={folder.id}
            folderName={folder.name}
          />
          <Badge variant="secondary">{folder.unreadCount} unread</Badge>
        </>
      }
    />
  )
}

function FolderFeedBrowser({
  feeds,
  folderId,
  folderName,
}: {
  feeds: FeedSubscriptionNavItem[]
  folderId: string
  folderName: string
}) {
  if (!feeds.length) {
    return null
  }

  return (
    <details className="relative">
      <summary
        className={`${buttonVariants({
          size: "sm",
          variant: "outline",
        })} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
      >
        Feeds in this folder
      </summary>
      <nav
        aria-label={`Feeds in ${folderName}`}
        className="absolute right-0 z-30 mt-2 grid max-h-80 w-72 gap-1 overflow-y-auto rounded-lg border bg-popover p-2 text-popover-foreground shadow-lg"
      >
        <Link
          className="rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
          href={`/app/folder/${folderId}`}
        >
          Combined folder stream
        </Link>
        {feeds.map((feed) => (
          <Link
            className="flex min-w-0 items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
            href={`/app/feed/${feed.id}`}
            key={feed.id}
          >
            <span className="min-w-0 truncate">{feed.title}</span>
            {feed.unreadCount > 0 ? (
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {feed.unreadCount} unread
              </span>
            ) : null}
          </Link>
        ))}
      </nav>
    </details>
  )
}

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function nextPageHref(path: string, cursor: string | null) {
  return cursor ? `${path}?after=${encodeURIComponent(cursor)}` : undefined
}

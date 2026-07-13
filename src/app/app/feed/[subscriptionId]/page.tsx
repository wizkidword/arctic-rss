import { notFound, redirect } from "next/navigation"

import { auth } from "@/auth"
import { FeedRefreshButton } from "@/components/feed-refresh-button"
import { FeedUnsubscribeButton } from "@/components/feed-unsubscribe-button"
import { ReaderSurface } from "@/components/reader-surface"
import { Badge } from "@/components/ui/badge"
import { listArticleCollectionsForUser } from "@/lib/article-collections"
import { listReaderArticlePage } from "@/lib/articles"
import { getUserFeedSubscription } from "@/lib/feed-subscriptions"
import { normalizeDefaultView } from "@/lib/preferences"
import { normalizeDateTimePreferences, normalizeDisplayMode } from "@/lib/settings"
import { getOrCreateUserSettings } from "@/lib/user-settings"

export default async function FeedPage({
  params,
  searchParams,
}: {
  params: Promise<{ subscriptionId: string }>
  searchParams: Promise<{ after?: string | string[]; articleId?: string | string[] }>
}) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const { subscriptionId } = await params
  const query = await searchParams
  const [subscription, settings, articleCollections] = await Promise.all([
    getUserFeedSubscription(session.user.id, subscriptionId),
    getOrCreateUserSettings(session.user.id),
    listArticleCollectionsForUser(session.user.id),
  ])

  if (!subscription || subscription.id !== subscriptionId) {
    notFound()
  }

  const title = subscription.customTitle || subscription.feed.title
  const defaultView = normalizeDefaultView(settings.defaultView)
  const dateTimePreferences = normalizeDateTimePreferences(settings)
  const articlePage = await listReaderArticlePage({
    after: firstSearchParam(query.after),
    feedId: subscription.feedId,
    userId: session.user.id,
  })
  const articleId = firstSearchParam(query.articleId)

  return (
    <ReaderSurface
      articles={articlePage.articles}
      articleCollections={articleCollections}
      basePath={`/app/feed/${subscription.id}`}
      dateTimePreferences={dateTimePreferences}
      defaultView={defaultView}
      displayMode={normalizeDisplayMode(settings.displayMode)}
      description={
        subscription.feed.description ||
        subscription.feed.siteUrl ||
        subscription.feed.feedUrl
      }
      emptyMessage={`Refresh this feed to fetch the latest articles from ${subscription.feed.feedUrl}.`}
      markAllReadScope={{ feedId: subscription.feedId, type: "feed" }}
      nextPageHref={nextPageHref(
        `/app/feed/${subscription.id}`,
        articlePage.nextCursor
      )}
      selectedArticleId={articleId}
      title={title}
      toolbar={
        <>
          <Badge variant={subscription.feed.lastError ? "destructive" : "secondary"}>
            {subscription.feed.lastError ? "Needs attention" : "Subscribed"}
          </Badge>
          <FeedRefreshButton subscriptionId={subscription.id} />
          <FeedUnsubscribeButton
            feedTitle={title}
            subscriptionId={subscription.id}
          />
        </>
      }
    />
  )
}

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function nextPageHref(path: string, cursor: string | null) {
  return cursor ? `${path}?after=${encodeURIComponent(cursor)}` : undefined
}

import { notFound, redirect } from "next/navigation"

import { auth } from "@/auth"
import { FeedRefreshButton } from "@/components/feed-refresh-button"
import { FeedUnsubscribeButton } from "@/components/feed-unsubscribe-button"
import { ReaderSurface } from "@/components/reader-surface"
import { Badge } from "@/components/ui/badge"
import { listArticleCollectionsForUser } from "@/lib/article-collections"
import { listReaderArticles } from "@/lib/articles"
import { getUserFeedSubscription } from "@/lib/feed-subscriptions"
import { normalizeDefaultView } from "@/lib/preferences"
import { normalizeDateTimePreferences, normalizeDisplayMode } from "@/lib/settings"
import { getOrCreateUserSettings } from "@/lib/user-settings"

export default async function FeedPage({
  params,
  searchParams,
}: {
  params: Promise<{ subscriptionId: string }>
  searchParams: Promise<{ articleId?: string | string[] }>
}) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const { subscriptionId } = await params
  const [subscription, settings, articleCollections, query] = await Promise.all([
    getUserFeedSubscription(session.user.id, subscriptionId),
    getOrCreateUserSettings(session.user.id),
    listArticleCollectionsForUser(session.user.id),
    searchParams,
  ])

  if (!subscription || subscription.id !== subscriptionId) {
    notFound()
  }

  const title = subscription.customTitle || subscription.feed.title
  const defaultView = normalizeDefaultView(settings.defaultView)
  const dateTimePreferences = normalizeDateTimePreferences(settings)
  const articles = await listReaderArticles({
    feedId: subscription.feedId,
    userId: session.user.id,
  })
  const articleId = firstSearchParam(query.articleId)

  return (
    <ReaderSurface
      articles={articles}
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

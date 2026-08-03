import { notFound, redirect } from "next/navigation"

import { auth } from "@/auth"
import { FeedPauseButton } from "@/components/feed-pause-button"
import { FeedRefreshButton } from "@/components/feed-refresh-button"
import { FeedUnsubscribeButton } from "@/components/feed-unsubscribe-button"
import { ReaderSurface } from "@/components/reader-surface"
import { Badge } from "@/components/ui/badge"
import { listArticleCollectionsForUser } from "@/lib/article-collections"
import {
  listReaderArticlePage,
  loadReaderArticleView,
  readerArticlePageLimit,
} from "@/lib/articles"
import { getUserFeedSubscription } from "@/lib/feed-subscriptions"
import { normalizeDefaultView } from "@/lib/preferences"
import {
  formatArticleDateTime,
  normalizeDateTimePreferences,
  normalizeDisplayMode,
} from "@/lib/settings"
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
  const displayMode = normalizeDisplayMode(settings.displayMode)
  const feedHealth = feedHealthSummary(subscription, dateTimePreferences)
  const articlePage = await listReaderArticlePage({
    after: firstSearchParam(query.after),
    feedId: subscription.feedId,
    limit: readerArticlePageLimit({ defaultView, displayMode }),
    userId: session.user.id,
  })
  const articleId = firstSearchParam(query.articleId)
  const readerView = await loadReaderArticleView({
    articleIds: articlePage.articles.map((article) => article.id),
    defaultView,
    displayMode,
    selectedArticleId: articleId,
    userId: session.user.id,
  })

  return (
    <ReaderSurface
      articles={articlePage.articles}
      articleCollections={articleCollections}
      basePath={`/app/feed/${subscription.id}`}
      dateTimePreferences={dateTimePreferences}
      defaultView={defaultView}
      displayMode={displayMode}
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
      riverArticles={readerView.riverArticles}
      selectedArticle={readerView.selectedArticle ?? undefined}
      selectedArticleId={articleId}
      title={title}
      toolbar={
        <>
          <Badge
            variant={
              subscription.isPaused
                ? "outline"
                : subscription.feed.lastError
                  ? "destructive"
                  : "secondary"
            }
          >
            {subscription.isPaused
              ? "Paused"
              : subscription.feed.lastError
                ? "Needs attention"
                : "Subscribed"}
          </Badge>
          <span className="max-w-56 text-xs leading-5 text-muted-foreground">
            {feedHealth}
          </span>
          {!subscription.isPaused ? (
            <FeedRefreshButton subscriptionId={subscription.id} />
          ) : null}
          <FeedPauseButton
            isPaused={subscription.isPaused}
            subscriptionId={subscription.id}
          />
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

function feedHealthSummary(
  subscription: {
    feed: {
      lastError: string | null
      lastSuccessfulFetchAt: Date | null
    }
    isPaused: boolean
  },
  dateTimePreferences: Parameters<typeof formatArticleDateTime>[1]
) {
  if (subscription.isPaused) {
    return "This feed is paused. New articles will not be fetched until you resume it."
  }

  if (subscription.feed.lastError) {
    return "A recent refresh needs attention. Reload the feed to try again, or pause it while you decide what to do."
  }

  if (subscription.feed.lastSuccessfulFetchAt) {
    return `Last refreshed ${formatArticleDateTime(
      subscription.feed.lastSuccessfulFetchAt,
      dateTimePreferences
    )}.`
  }

  return "Waiting for the first successful refresh."
}

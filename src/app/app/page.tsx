import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { ReaderSurface } from "@/components/reader-surface"
import { listArticleCollectionsForUser } from "@/lib/article-collections"
import { listReaderArticlePage } from "@/lib/articles"
import { hasUserFeedSubscriptions } from "@/lib/feed-subscriptions"
import { normalizeDefaultView } from "@/lib/preferences"
import { normalizeDateTimePreferences, normalizeDisplayMode } from "@/lib/settings"
import { getOrCreateUserSettings } from "@/lib/user-settings"

export default async function AppHomePage({
  searchParams,
}: {
  searchParams: Promise<{ after?: string | string[]; articleId?: string | string[] }>
}) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const hasSubscriptions = await hasUserFeedSubscriptions(session.user.id)

  if (!hasSubscriptions) {
    redirect("/app/discover")
  }

  const params = await searchParams
  const [settings, articlePage, articleCollections] = await Promise.all([
    getOrCreateUserSettings(session.user.id),
    listReaderArticlePage({
      after: firstSearchParam(params.after),
      userId: session.user.id,
    }),
    listArticleCollectionsForUser(session.user.id),
  ])
  const defaultView = normalizeDefaultView(settings.defaultView)
  const dateTimePreferences = normalizeDateTimePreferences(settings)
  const articleId = firstSearchParam(params.articleId)

  return (
    <ReaderSurface
      articles={articlePage.articles}
      articleCollections={articleCollections}
      basePath="/app"
      dateTimePreferences={dateTimePreferences}
      defaultView={defaultView}
      displayMode={normalizeDisplayMode(settings.displayMode)}
      description="Recent articles from every active feed subscription."
      emptyMessage="Add or refresh a feed to start filling the reader."
      markAllReadScope={{ type: "all" }}
      nextPageHref={nextPageHref("/app", articlePage.nextCursor)}
      selectedArticleId={articleId}
      title="All Articles"
    />
  )
}

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function nextPageHref(path: string, cursor: string | null) {
  return cursor ? `${path}?after=${encodeURIComponent(cursor)}` : undefined
}

import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { ReaderSurface } from "@/components/reader-surface"
import { listArticleCollectionsForUser } from "@/lib/article-collections"
import { listReaderArticlePage } from "@/lib/articles"
import { normalizeDefaultView } from "@/lib/preferences"
import { normalizeDateTimePreferences, normalizeDisplayMode } from "@/lib/settings"
import { getOrCreateUserSettings } from "@/lib/user-settings"

export default async function UnreadPage({
  searchParams,
}: {
  searchParams: Promise<{ after?: string | string[]; articleId?: string | string[] }>
}) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const params = await searchParams
  const [settings, articlePage, articleCollections] = await Promise.all([
    getOrCreateUserSettings(session.user.id),
    listReaderArticlePage({
      after: firstSearchParam(params.after),
      unreadOnly: true,
      userId: session.user.id,
    }),
    listArticleCollectionsForUser(session.user.id),
  ])

  return (
    <ReaderSurface
      articles={articlePage.articles}
      articleCollections={articleCollections}
      basePath="/app/unread"
      dateTimePreferences={normalizeDateTimePreferences(settings)}
      defaultView={normalizeDefaultView(settings.defaultView)}
      displayMode={normalizeDisplayMode(settings.displayMode)}
      description="Unread articles from every active feed subscription."
      emptyMessage="No unread articles."
      markAllReadScope={{ type: "all" }}
      nextPageHref={nextPageHref("/app/unread", articlePage.nextCursor)}
      selectedArticleId={firstSearchParam(params.articleId)}
      title="Unread"
    />
  )
}

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function nextPageHref(path: string, cursor: string | null) {
  return cursor ? `${path}?after=${encodeURIComponent(cursor)}` : undefined
}

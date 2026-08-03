import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { ReaderSurface } from "@/components/reader-surface"
import { listArticleCollectionsForUser } from "@/lib/article-collections"
import {
  listReaderArticlePage,
  loadReaderArticleView,
  readerArticlePageLimit,
} from "@/lib/articles"
import { normalizeDefaultView } from "@/lib/preferences"
import { normalizeDateTimePreferences, normalizeDisplayMode } from "@/lib/settings"
import { getOrCreateUserSettings } from "@/lib/user-settings"

export default async function StarredPage({
  searchParams,
}: {
  searchParams: Promise<{ after?: string | string[]; articleId?: string | string[] }>
}) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const params = await searchParams
  const settings = await getOrCreateUserSettings(session.user.id)
  const defaultView = normalizeDefaultView(settings.defaultView)
  const displayMode = normalizeDisplayMode(settings.displayMode)
  const [articlePage, articleCollections] = await Promise.all([
    listReaderArticlePage({
      after: firstSearchParam(params.after),
      limit: readerArticlePageLimit({ defaultView, displayMode }),
      starredOnly: true,
      userId: session.user.id,
    }),
    listArticleCollectionsForUser(session.user.id),
  ])
  const articleId = firstSearchParam(params.articleId)
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
      basePath="/app/starred"
      dateTimePreferences={normalizeDateTimePreferences(settings)}
      defaultView={defaultView}
      displayMode={displayMode}
      description="Articles you have starred."
      emptyMessage="No starred articles."
      nextPageHref={nextPageHref("/app/starred", articlePage.nextCursor)}
      riverArticles={readerView.riverArticles}
      selectedArticle={readerView.selectedArticle ?? undefined}
      selectedArticleId={articleId}
      title="Starred"
    />
  )
}

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function nextPageHref(path: string, cursor: string | null) {
  return cursor ? `${path}?after=${encodeURIComponent(cursor)}` : undefined
}

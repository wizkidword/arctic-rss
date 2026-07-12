import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { ReaderSurface } from "@/components/reader-surface"
import { listArticleCollectionsForUser } from "@/lib/article-collections"
import { listReaderArticles } from "@/lib/articles"
import { normalizeDefaultView } from "@/lib/preferences"
import { normalizeDateTimePreferences, normalizeDisplayMode } from "@/lib/settings"
import { getOrCreateUserSettings } from "@/lib/user-settings"

export default async function UnreadPage({
  searchParams,
}: {
  searchParams: Promise<{ articleId?: string | string[] }>
}) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const [settings, articles, articleCollections, params] = await Promise.all([
    getOrCreateUserSettings(session.user.id),
    listReaderArticles({
      unreadOnly: true,
      userId: session.user.id,
    }),
    listArticleCollectionsForUser(session.user.id),
    searchParams,
  ])

  return (
    <ReaderSurface
      articles={articles}
      articleCollections={articleCollections}
      basePath="/app/unread"
      dateTimePreferences={normalizeDateTimePreferences(settings)}
      defaultView={normalizeDefaultView(settings.defaultView)}
      displayMode={normalizeDisplayMode(settings.displayMode)}
      description="Unread articles from every active feed subscription."
      emptyMessage="No unread articles."
      markAllReadScope={{ type: "all" }}
      selectedArticleId={firstSearchParam(params.articleId)}
      title="Unread"
    />
  )
}

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

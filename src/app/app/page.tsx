import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { ReaderSurface } from "@/components/reader-surface"
import { listReaderArticles } from "@/lib/articles"
import { normalizeDefaultView } from "@/lib/preferences"
import { getOrCreateUserSettings } from "@/lib/user-settings"

export default async function AppHomePage({
  searchParams,
}: {
  searchParams: Promise<{ articleId?: string | string[] }>
}) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const [settings, articles, params] = await Promise.all([
    getOrCreateUserSettings(session.user.id),
    listReaderArticles({
      userId: session.user.id,
    }),
    searchParams,
  ])
  const defaultView = normalizeDefaultView(settings.defaultView)
  const articleId = firstSearchParam(params.articleId)

  return (
    <ReaderSurface
      articles={articles}
      basePath="/app"
      defaultView={defaultView}
      description="Recent articles from every active feed subscription."
      emptyMessage="Add or refresh a feed to start filling the reader."
      markAllReadScope={{ type: "all" }}
      selectedArticleId={articleId}
      title="All Articles"
    />
  )
}

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

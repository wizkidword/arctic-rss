import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { ReaderSurface } from "@/components/reader-surface"
import { listReaderArticles } from "@/lib/articles"
import { normalizeDefaultView } from "@/lib/preferences"
import { getOrCreateUserSettings } from "@/lib/user-settings"

export default async function StarredPage({
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
      starredOnly: true,
      userId: session.user.id,
    }),
    searchParams,
  ])

  return (
    <ReaderSurface
      articles={articles}
      basePath="/app/starred"
      defaultView={normalizeDefaultView(settings.defaultView)}
      description="Articles you have starred."
      emptyMessage="No starred articles."
      selectedArticleId={firstSearchParam(params.articleId)}
      title="Starred"
    />
  )
}

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

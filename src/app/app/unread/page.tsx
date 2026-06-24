import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { ReaderSurface } from "@/components/reader-surface"
import { listReaderArticles } from "@/lib/articles"
import { normalizeDefaultView } from "@/lib/preferences"
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

  const [settings, articles, params] = await Promise.all([
    getOrCreateUserSettings(session.user.id),
    listReaderArticles({
      unreadOnly: true,
      userId: session.user.id,
    }),
    searchParams,
  ])

  return (
    <ReaderSurface
      articles={articles}
      basePath="/app/unread"
      defaultView={normalizeDefaultView(settings.defaultView)}
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

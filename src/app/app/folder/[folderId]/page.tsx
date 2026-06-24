import { notFound, redirect } from "next/navigation"

import { auth } from "@/auth"
import { ReaderSurface } from "@/components/reader-surface"
import { Badge } from "@/components/ui/badge"
import { listReaderArticles } from "@/lib/articles"
import { getUserFolder } from "@/lib/folders"
import { normalizeDefaultView } from "@/lib/preferences"
import { getOrCreateUserSettings } from "@/lib/user-settings"

export default async function FolderPage({
  params,
  searchParams,
}: {
  params: Promise<{ folderId: string }>
  searchParams: Promise<{ articleId?: string | string[] }>
}) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const { folderId } = await params
  const [folder, settings, articles, query] = await Promise.all([
    getUserFolder(session.user.id, folderId),
    getOrCreateUserSettings(session.user.id),
    listReaderArticles({
      folderId,
      userId: session.user.id,
    }),
    searchParams,
  ])

  if (!folder) {
    notFound()
  }

  return (
    <ReaderSurface
      articles={articles}
      basePath={`/app/folder/${folder.id}`}
      defaultView={normalizeDefaultView(settings.defaultView)}
      description={`${folder.subscriptionCount} ${
        folder.subscriptionCount === 1 ? "feed" : "feeds"
      } in this folder.`}
      emptyMessage="This folder has no stored articles yet. Move feeds into it or refresh its feeds."
      markAllReadScope={{ folderId: folder.id, type: "folder" }}
      selectedArticleId={firstSearchParam(query.articleId)}
      title={folder.name}
      toolbar={<Badge variant="secondary">{folder.unreadCount} unread</Badge>}
    />
  )
}

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

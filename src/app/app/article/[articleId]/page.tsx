import { notFound, redirect } from "next/navigation"

import { auth } from "@/auth"
import { DiscussInChatButton } from "@/components/discuss-in-chat-button"
import { ReaderSurface } from "@/components/reader-surface"
import { listArticleCollectionsForUser } from "@/lib/article-collections"
import {
  getReaderArticleForUser,
  listReaderArticles,
  type ReaderArticle,
} from "@/lib/articles"
import { normalizeDefaultView } from "@/lib/preferences"
import { normalizeDateTimePreferences, normalizeDisplayMode } from "@/lib/settings"
import { getOrCreateUserSettings } from "@/lib/user-settings"
import { listChatRoomRecommendationsForArticle } from "@/lib/chat/article-recommendations"
import { isChatEnabled } from "@/lib/chat/feature-flags"

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ articleId: string }>
}) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const { articleId } = await params
  const chatEnabled = isChatEnabled()
  const [settings, selectedArticle, articles, articleCollections, chatRooms] = await Promise.all([
    getOrCreateUserSettings(session.user.id),
    getReaderArticleForUser({
      articleId,
      userId: session.user.id,
    }),
    listReaderArticles({
      userId: session.user.id,
    }),
    listArticleCollectionsForUser(session.user.id),
    chatEnabled
      ? listChatRoomRecommendationsForArticle({
          articleId,
          userId: session.user.id,
        })
      : Promise.resolve([]),
  ])

  if (!selectedArticle) {
    notFound()
  }

  const readerArticles = mergeSelectedArticle(selectedArticle, articles)

  return (
    <ReaderSurface
      articles={readerArticles}
      articleCollections={articleCollections}
      basePath="/app"
      dateTimePreferences={normalizeDateTimePreferences(settings)}
      defaultView={normalizeDefaultView(settings.defaultView)}
      displayMode={normalizeDisplayMode(settings.displayMode)}
      description={`${selectedArticle.feedTitle} - stable article view.`}
      emptyMessage="That article is not available in your active subscriptions."
      selectedArticleId={selectedArticle.id}
      title="Article"
      toolbar={
        chatEnabled ? (
          <DiscussInChatButton articleId={selectedArticle.id} rooms={chatRooms} />
        ) : null
      }
    />
  )
}

function mergeSelectedArticle(
  selectedArticle: ReaderArticle,
  articles: ReaderArticle[]
) {
  if (articles.some((article) => article.id === selectedArticle.id)) {
    return articles
  }

  return [selectedArticle, ...articles]
}

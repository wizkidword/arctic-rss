import { notFound, redirect } from "next/navigation"

import { auth } from "@/auth"
import { DiscussInChatButton } from "@/components/discuss-in-chat-button"
import { ReaderSurface } from "@/components/reader-surface"
import { listArticleCollectionsForUser } from "@/lib/article-collections"
import {
  getReaderArticleForUser,
  listReaderArticlePage,
  listReaderArticlesByIdsForUser,
  readerArticlePageLimit,
  type ReaderArticle,
  type ReaderArticleListItem,
  RIVER_READER_DETAIL_LIMIT,
} from "@/lib/articles"
import { normalizeDefaultView } from "@/lib/preferences"
import { normalizeDateTimePreferences, normalizeDisplayMode } from "@/lib/settings"
import { listStoryClustersForArticleUser } from "@/lib/story-cluster-reader"
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
  const [settings, selectedArticle, articleCollections, chatRooms, storyClusters] = await Promise.all([
    getOrCreateUserSettings(session.user.id),
    getReaderArticleForUser({
      articleId,
      userId: session.user.id,
    }),
    listArticleCollectionsForUser(session.user.id),
    chatEnabled
      ? listChatRoomRecommendationsForArticle({
          articleId,
          userId: session.user.id,
        })
      : Promise.resolve([]),
    listStoryClustersForArticleUser({
      articleId,
      userId: session.user.id,
    }),
  ])

  if (!selectedArticle) {
    notFound()
  }

  const defaultView = normalizeDefaultView(settings.defaultView)
  const displayMode = normalizeDisplayMode(settings.displayMode)
  const articlePage = await listReaderArticlePage({
    limit: readerArticlePageLimit({ defaultView, displayMode }),
    userId: session.user.id,
  })
  const readerArticles = mergeSelectedArticle(selectedArticle, articlePage.articles)
  const riverArticles =
    displayMode === "READER" || defaultView === "RIVER"
      ? await listReaderArticlesByIdsForUser({
          articleIds: readerArticles
            .slice(0, RIVER_READER_DETAIL_LIMIT)
            .map((article) => article.id),
          userId: session.user.id,
        })
      : []

  return (
    <ReaderSurface
      articles={readerArticles}
      articleCollections={articleCollections}
      basePath="/app"
      dateTimePreferences={normalizeDateTimePreferences(settings)}
      defaultView={defaultView}
      displayMode={displayMode}
      description={`${selectedArticle.feedTitle} - stable article view.`}
      emptyMessage="That article is not available in your active subscriptions."
      riverArticles={riverArticles}
      selectedArticle={selectedArticle}
      selectedArticleId={selectedArticle.id}
      storyClusters={storyClusters}
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
  articles: ReaderArticleListItem[]
) {
  if (articles.some((article) => article.id === selectedArticle.id)) {
    return articles
  }

  return [selectedArticle, ...articles]
}

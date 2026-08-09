import { notFound, redirect } from "next/navigation"

import { auth } from "@/auth"
import { PodcastEpisodeList } from "@/components/podcast-episode-list"
import { ReaderSurface } from "@/components/reader-surface"
import { Badge } from "@/components/ui/badge"
import { listArticleCollectionsForUser } from "@/lib/article-collections"
import {
  listReaderArticlePage,
  loadReaderArticleView,
  readerArticlePageLimit,
  type ReaderArticleListItem,
} from "@/lib/articles"
import {
  listCollectionArticleRetentionForUser,
  type CollectionArticleRetention,
} from "@/lib/collection-retention"
import { listCollectionPodcastEpisodesForUser } from "@/lib/podcasts"
import { normalizeDefaultView } from "@/lib/preferences"
import { normalizeDateTimePreferences, normalizeDisplayMode } from "@/lib/settings"
import { getOrCreateUserSettings } from "@/lib/user-settings"

export default async function CollectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ collectionId: string }>
  searchParams: Promise<{ after?: string | string[]; articleId?: string | string[] }>
}) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const { collectionId } = await params
  const query = await searchParams
  const [collections, settings, podcastEpisodes] =
    await Promise.all([
    listArticleCollectionsForUser(session.user.id),
    getOrCreateUserSettings(session.user.id),
    listCollectionPodcastEpisodesForUser({
      collectionId,
      userId: session.user.id,
    }),
  ])
  const collection = collections.find((item) => item.id === collectionId)

  if (!collection) {
    notFound()
  }

  const currentCollection = {
    id: collection.id,
    name: collection.name,
  }
  const dateTimePreferences = normalizeDateTimePreferences(settings)
  const defaultView = normalizeDefaultView(settings.defaultView)
  const displayMode = normalizeDisplayMode(settings.displayMode)
  const articleId = firstSearchParam(query.articleId)
  const articlePage = await listReaderArticlePage({
    after: firstSearchParam(query.after),
    collectionId,
    limit: readerArticlePageLimit({ defaultView, displayMode }),
    userId: session.user.id,
  })

  if (!articlePage.articles.length && podcastEpisodes.length) {
    return (
      <div className="flex min-h-screen flex-col gap-4 p-3 sm:p-4 lg:p-6">
        <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-xl font-semibold">
                {collection.name}
              </h1>
              <Badge variant="secondary">
                {collection.articleCount} saved
              </Badge>
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Saved articles and podcast episodes stay here even after you stop
              following their source.
            </p>
          </div>
        </section>
        <PodcastEpisodeList
          collections={collections}
          currentCollection={currentCollection}
          dateTimePreferences={dateTimePreferences}
          episodes={podcastEpisodes}
        />
      </div>
    )
  }

  const articleIds = articlePage.articles.map((article) => article.id)
  const [retentionByArticleId, readerView] = await Promise.all([
    listCollectionArticleRetentionForUser({
      articleIds,
      collectionId,
      userId: session.user.id,
    }),
    loadReaderArticleView({
      articleIds,
      defaultView,
      displayMode,
      selectedArticleId: articleId,
      userId: session.user.id,
    }),
  ])

  return (
    <>
      <ReaderSurface
        articles={withCollectionRetention(
          articlePage.articles,
          retentionByArticleId
        )}
        articleCollections={collections}
        basePath={`/app/collections/${collection.id}`}
        currentCollection={currentCollection}
        dateTimePreferences={dateTimePreferences}
        defaultView={defaultView}
        displayMode={displayMode}
        description="Saved articles and podcast episodes stay here even after you stop following their source. If this is your last saved collection copy, removing it will remove access unless you follow the source again."
        emptyMessage="Save articles or podcast episodes to this collection from their menus."
        nextPageHref={nextPageHref(
          `/app/collections/${collection.id}`,
          articlePage.nextCursor
        )}
        riverArticles={withCollectionRetention(
          readerView.riverArticles,
          retentionByArticleId
        )}
        selectedArticle={withCollectionRetention(
          readerView.selectedArticle,
          retentionByArticleId
        )}
        selectedArticleId={articleId}
        title={collection.name}
        toolbar={
          <Badge variant="secondary">
            {collection.articleCount} saved
          </Badge>
        }
      />
      {podcastEpisodes.length ? (
        <section className="space-y-3 px-3 pb-6 sm:px-4 lg:px-6">
          <header className="rounded-lg border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-heading text-base font-semibold">
                Podcast Episodes
              </h2>
              <Badge variant="secondary">
                {podcastEpisodes.length}{" "}
                {podcastEpisodes.length === 1 ? "episode" : "episodes"}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Saved podcast episodes in this collection.
            </p>
          </header>
          <PodcastEpisodeList
            collections={collections}
            currentCollection={currentCollection}
            dateTimePreferences={dateTimePreferences}
            episodes={podcastEpisodes}
          />
        </section>
      ) : null}
    </>
  )
}

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function nextPageHref(path: string, cursor: string | null) {
  return cursor ? `${path}?after=${encodeURIComponent(cursor)}` : undefined
}

function withCollectionRetention<T extends ReaderArticleListItem>(
  article: T,
  retentionByArticleId: Map<string, CollectionArticleRetention>
): T
function withCollectionRetention<T extends ReaderArticleListItem>(
  article: T | null,
  retentionByArticleId: Map<string, CollectionArticleRetention>
): T | undefined
function withCollectionRetention<T extends ReaderArticleListItem>(
  articles: T[],
  retentionByArticleId: Map<string, CollectionArticleRetention>
): T[]
function withCollectionRetention<T extends ReaderArticleListItem>(
  articleOrArticles: T | T[] | null,
  retentionByArticleId: Map<string, CollectionArticleRetention>
): T | T[] | undefined {
  if (Array.isArray(articleOrArticles)) {
    return articleOrArticles.map((article) =>
      withCollectionRetention(article, retentionByArticleId)
    )
  }

  if (!articleOrArticles) {
    return undefined
  }

  const retention = retentionByArticleId.get(articleOrArticles.id)

  return retention
    ? { ...articleOrArticles, collectionRetention: retention }
    : articleOrArticles
}

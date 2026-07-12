import { notFound, redirect } from "next/navigation"

import { auth } from "@/auth"
import { PodcastEpisodeList } from "@/components/podcast-episode-list"
import { ReaderSurface } from "@/components/reader-surface"
import { Badge } from "@/components/ui/badge"
import { listArticleCollectionsForUser } from "@/lib/article-collections"
import { listReaderArticles } from "@/lib/articles"
import { listCollectionPodcastEpisodesForUser } from "@/lib/podcasts"
import { normalizeDefaultView } from "@/lib/preferences"
import { normalizeDateTimePreferences, normalizeDisplayMode } from "@/lib/settings"
import { getOrCreateUserSettings } from "@/lib/user-settings"

export default async function CollectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ collectionId: string }>
  searchParams: Promise<{ articleId?: string | string[] }>
}) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const { collectionId } = await params
  const [collections, settings, articles, podcastEpisodes, query] =
    await Promise.all([
    listArticleCollectionsForUser(session.user.id),
    getOrCreateUserSettings(session.user.id),
    listReaderArticles({
      collectionId,
      userId: session.user.id,
    }),
    listCollectionPodcastEpisodesForUser({
      collectionId,
      userId: session.user.id,
    }),
    searchParams,
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

  if (!articles.length && podcastEpisodes.length) {
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
              Saved articles and podcast episodes in this collection.
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

  return (
    <>
      <ReaderSurface
        articles={articles}
        articleCollections={collections}
        basePath={`/app/collections/${collection.id}`}
        currentCollection={currentCollection}
        dateTimePreferences={dateTimePreferences}
        defaultView={normalizeDefaultView(settings.defaultView)}
        displayMode={normalizeDisplayMode(settings.displayMode)}
        description="Saved articles and podcast episodes in this collection."
        emptyMessage="Save articles or podcast episodes to this collection from their menus."
        selectedArticleId={firstSearchParam(query.articleId)}
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

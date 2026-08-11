import { useCallback } from "react"
import { useLocalSearchParams } from "expo-router"
import { Text } from "react-native"

import type { SavedView } from "@arctic-rss/api-contract"

import { ArticleList } from "@/components/article-list"
import { Loading, Notice, Screen, Section, mobileStyles } from "@/components/mobile-ui"
import { useMobileQuery } from "@/hooks/use-mobile-query"
import { useMobileApp } from "@/providers/mobile-app-provider"

function SavedViewArticles({ view }: { view: SavedView }) {
  const { api } = useMobileApp()
  const query = useMobileQuery(
    `saved-view:${view.id}`,
    useCallback(
      (signal: AbortSignal) =>
        api.search({
          collectionId: view.collectionId ?? undefined,
          folderId: view.folderId ?? undefined,
          from: view.publishedAfter?.slice(0, 10),
          limit: 30,
          q: view.query,
          sourceId: view.sourceId ?? undefined,
          state: view.state,
          to: view.publishedBefore?.slice(0, 10),
        }, { signal }),
      [api, view]
    )
  )

  return (
    <Section title="Matching articles">
      {query.error ? <Notice>{query.error}</Notice> : null}
      {query.data ? query.data.data.articles.length ? <ArticleList articles={query.data.data.articles} /> : <Text style={mobileStyles.muted}>No articles currently match this saved view.</Text> : <Loading />}
    </Section>
  )
}

export default function SavedViewScreen() {
  const { savedViewId: rawSavedViewId } = useLocalSearchParams<{ savedViewId: string }>()
  const savedViewId = Array.isArray(rawSavedViewId) ? rawSavedViewId[0] : rawSavedViewId
  const { api } = useMobileApp()
  const savedViews = useMobileQuery(
    "saved-views",
    useCallback((signal: AbortSignal) => api.savedViews({ signal }), [api])
  )
  const view = savedViews.data?.data.savedViews.find((item) => item.id === savedViewId)

  return (
    <Screen isRefreshing={savedViews.isRefreshing} onRefresh={savedViews.refresh} title="Saved view">
      {savedViews.error ? <Notice>{savedViews.error}</Notice> : null}
      {savedViews.data && !view ? <Notice>This saved view is unavailable.</Notice> : null}
      {view ? (
        <>
          <Section>
            <Text style={mobileStyles.listTitle}>{view.name}</Text>
            <Text style={mobileStyles.muted}>{(view.description ?? view.query) || "All articles"}</Text>
          </Section>
          <SavedViewArticles view={view} />
        </>
      ) : <Loading />}
    </Screen>
  )
}

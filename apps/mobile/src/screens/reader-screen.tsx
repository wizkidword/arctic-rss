import { useCallback } from "react"
import { router } from "expo-router"
import { Text, View } from "react-native"

import { ArticleList } from "@/components/article-list"
import { ActionButton, Loading, Notice, Screen, Section, mobileStyles } from "@/components/mobile-ui"
import { useMobilePagination } from "@/hooks/use-mobile-pagination"
import { useMobileApp } from "@/providers/mobile-app-provider"

export function ReaderScreen({
  collectionId,
  state = "all",
}: {
  collectionId?: string
  state?: "all" | "starred" | "unread"
}) {
  const { api } = useMobileApp()
  const load = useCallback(
    ({ cursor, signal }: { cursor?: string; signal: AbortSignal }) =>
      api.reader({ collectionId, cursor, limit: 30, state }, { signal }),
    [api, collectionId, state]
  )
  const page = useMobilePagination(
    `reader:${collectionId ?? "all"}:${state}`,
    load,
    useCallback((response) => response.data.articles, []),
    useCallback((article) => article.id, [])
  )

  return (
    <Screen isRefreshing={page.isRefreshing} onRefresh={page.refresh} title={collectionId ? "Collection" : "Articles"}>
      {!collectionId ? (
        <View style={mobileStyles.actionRow}>
          <ActionButton onPress={() => router.replace("/(authenticated)/(tabs)")} tone={state === "all" ? "primary" : "secondary"}>All</ActionButton>
          <ActionButton onPress={() => router.replace("/(authenticated)/(tabs)/unread")} tone={state === "unread" ? "primary" : "secondary"}>Unread</ActionButton>
          <ActionButton onPress={() => router.replace("/(authenticated)/(tabs)/starred")} tone={state === "starred" ? "primary" : "secondary"}>Starred</ActionButton>
        </View>
      ) : null}
      {page.error ? <Notice>{page.error}</Notice> : null}
      <Section>
        {page.items.length ? <ArticleList articles={page.items} collectionId={collectionId} hasOfflineCopy={page.hasOfflineCopy} /> : page.isRefreshing ? <Loading /> : <Text style={mobileStyles.muted}>No articles match this view.</Text>}
        {page.hasNextPage ? <ActionButton disabled={page.isLoadingMore} onPress={() => void page.loadMore()} tone="secondary">{page.isLoadingMore ? "Loading more articles…" : "Load more articles"}</ActionButton> : null}
        {page.isTruncated ? <Notice tone="info">Showing the first 300 articles. Refine this view to load a smaller result set.</Notice> : null}
        {!page.hasNextPage && page.items.length > 0 && !page.isTruncated ? <Text style={mobileStyles.muted}>You have reached the end of this view.</Text> : null}
      </Section>
    </Screen>
  )
}

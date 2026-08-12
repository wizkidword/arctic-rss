import { useCallback, useEffect, useState } from "react"
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
  const { api, offline } = useMobileApp()
  const [offlineSelection, setOfflineSelection] = useState(false)
  const [offlineSelectionMessage, setOfflineSelectionMessage] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    if (!collectionId) {
      void Promise.resolve().then(() => {
        if (active) {
          setOfflineSelection(false)
        }
      })
      return
    }
    void offline.selectedOfflineCollectionIds().then((ids) => {
      if (active) {
        setOfflineSelection(ids.includes(collectionId))
      }
    }).catch(() => {
      if (active) {
        setOfflineSelection(false)
      }
    })
    return () => {
      active = false
    }
  }, [collectionId, offline])
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
      {offlineSelectionMessage ? <Notice tone="info">{offlineSelectionMessage}</Notice> : null}
      <Section>
        {collectionId ? <ActionButton onPress={() => void (async () => {
          try {
            const next = !offlineSelection
            await offline.setCollectionOfflineSelected(collectionId, next)
            setOfflineSelection(next)
            setOfflineSelectionMessage(next
              ? "This collection is selected for offline reading. Its downloaded articles stay on this device within the storage limit."
              : "This collection is no longer selected for offline reading. Existing downloaded copies remain until cleared or evicted."
            )
          } catch (error) {
            setOfflineSelectionMessage(error instanceof Error ? error.message : "Arctic RSS could not update the offline selection.")
          }
        })()} tone="secondary">{offlineSelection ? "Remove offline selection" : "Keep this collection offline"}</ActionButton> : null}
        {page.items.length ? <ArticleList articles={page.items} collectionId={collectionId} hasOfflineCopy={page.hasOfflineCopy} /> : page.isRefreshing ? <Loading /> : <Text style={mobileStyles.muted}>No articles match this view.</Text>}
        {page.hasNextPage ? <ActionButton disabled={page.isLoadingMore} onPress={() => void page.loadMore()} tone="secondary">{page.isLoadingMore ? "Loading more articles…" : "Load more articles"}</ActionButton> : null}
        {page.isTruncated ? <Notice tone="info">Showing the first 300 articles. Refine this view to load a smaller result set.</Notice> : null}
        {!page.hasNextPage && page.items.length > 0 && !page.isTruncated ? <Text style={mobileStyles.muted}>You have reached the end of this view.</Text> : null}
      </Section>
    </Screen>
  )
}

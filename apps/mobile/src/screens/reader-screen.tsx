import { useCallback } from "react"
import { router } from "expo-router"
import { Text, View } from "react-native"

import { ArticleList } from "@/components/article-list"
import { ActionButton, Loading, Notice, Screen, Section, mobileStyles } from "@/components/mobile-ui"
import { useMobileQuery } from "@/hooks/use-mobile-query"
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
    () => api.reader({ collectionId, limit: 30, state }),
    [api, collectionId, state]
  )
  const { data, error, isRefreshing, refresh } = useMobileQuery(
    `reader:${collectionId ?? "all"}:${state}`,
    load
  )

  return (
    <Screen isRefreshing={isRefreshing} onRefresh={refresh} title={collectionId ? "Collection" : "Articles"}>
      {!collectionId ? (
        <View style={mobileStyles.actionRow}>
          <ActionButton onPress={() => router.replace("/(tabs)")} tone={state === "all" ? "primary" : "secondary"}>All</ActionButton>
          <ActionButton onPress={() => router.replace("/(tabs)/unread")} tone={state === "unread" ? "primary" : "secondary"}>Unread</ActionButton>
          <ActionButton onPress={() => router.replace("/(tabs)/starred")} tone={state === "starred" ? "primary" : "secondary"}>Starred</ActionButton>
        </View>
      ) : null}
      {error ? <Notice>{error}</Notice> : null}
      <Section>
        {data ? data.data.articles.length ? <ArticleList articles={data.data.articles} collectionId={collectionId} /> : <Text style={mobileStyles.muted}>No articles match this view.</Text> : <Loading />}
      </Section>
    </Screen>
  )
}

import { useCallback } from "react"
import { router } from "expo-router"
import { Pressable, Text, View } from "react-native"

import { Loading, Notice, Screen, Section, mobileStyles } from "@/components/mobile-ui"
import { useMobileQuery } from "@/hooks/use-mobile-query"
import { useMobileApp } from "@/providers/mobile-app-provider"

export default function LibraryScreen() {
  const { api } = useMobileApp()
  const collections = useMobileQuery("collections", useCallback(() => api.collections(), [api]))
  const savedViews = useMobileQuery("saved-views", useCallback(() => api.savedViews(), [api]))
  const podcasts = useMobileQuery("podcasts", useCallback(() => api.podcasts(), [api]))
  const briefings = useMobileQuery("briefings", useCallback(() => api.briefings(), [api]))

  return (
    <Screen title="Library">
      {collections.error || savedViews.error || podcasts.error || briefings.error ? <Notice>{collections.error ?? savedViews.error ?? podcasts.error ?? briefings.error}</Notice> : null}
      <Section title="Saved views">
        {savedViews.data ? savedViews.data.data.savedViews.length ? savedViews.data.data.savedViews.map((view) => (
          <Pressable key={view.id} onPress={() => router.push({ pathname: "/saved-view/[savedViewId]", params: { savedViewId: view.id } })} style={mobileStyles.listItem}>
            <Text style={mobileStyles.listTitle}>{view.name}</Text>
            <Text style={mobileStyles.muted}>{view.query || "All articles"}{view.monitorEnabled ? " · Monitor on" : ""}</Text>
          </Pressable>
        )) : <Text style={mobileStyles.muted}>No saved views yet.</Text> : <Loading />}
      </Section>
      <Section title="Collections">
        {collections.data ? collections.data.data.collections.length ? collections.data.data.collections.map((collection) => (
          <Pressable key={collection.id} onPress={() => router.push({ pathname: "/collection/[collectionId]", params: { collectionId: collection.id } })} style={mobileStyles.listItem}>
            <Text style={mobileStyles.listTitle}>{collection.name}</Text>
            <Text style={mobileStyles.muted}>{collection.itemCount} saved items</Text>
          </Pressable>
        )) : <Text style={mobileStyles.muted}>No collections yet.</Text> : <Loading />}
      </Section>
      <Section title="Podcasts">
        {podcasts.data ? podcasts.data.data.episodes.length ? podcasts.data.data.episodes.map((episode) => (
          <Pressable key={episode.id} onPress={() => router.push({ pathname: "/podcast/[episodeId]", params: { episodeId: episode.id } })} style={mobileStyles.listItem}>
            <Text style={mobileStyles.listTitle}>{episode.title}</Text>
            <Text style={mobileStyles.muted}>{episode.podcast.title}{episode.isPlayed ? " · Played" : ""}</Text>
          </Pressable>
        )) : <Text style={mobileStyles.muted}>No podcast episodes yet.</Text> : <Loading />}
      </Section>
      <Section title="Briefings">
        {briefings.data ? briefings.data.data.briefings.length ? briefings.data.data.briefings.map((briefing) => (
          <Pressable key={briefing.id} onPress={() => router.push({ pathname: "/briefing/[briefingId]", params: { briefingId: briefing.id } })} style={mobileStyles.listItem}>
            <Text style={mobileStyles.listTitle}>{briefing.title}</Text>
            <Text style={mobileStyles.muted}>{briefing.status.replaceAll("_", " ")} · {briefing.articleCount} articles</Text>
          </Pressable>
        )) : <Text style={mobileStyles.muted}>No briefings yet.</Text> : <Loading />}
      </Section>
      <View />
    </Screen>
  )
}

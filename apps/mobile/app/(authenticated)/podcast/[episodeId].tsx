import { useCallback, useState } from "react"
import * as Crypto from "expo-crypto"
import { useLocalSearchParams } from "expo-router"
import { Text } from "react-native"

import { ActionButton, Loading, Notice, Screen, Section, mobileStyles } from "@/components/mobile-ui"
import { useMobileQuery } from "@/hooks/use-mobile-query"
import { useMobileApp } from "@/providers/mobile-app-provider"
import { submitMobileMutation } from "@/sync/submit-mobile-mutation"

export default function PodcastEpisodeScreen() {
  const { episodeId: rawEpisodeId } = useLocalSearchParams<{ episodeId: string }>()
  const episodeId = Array.isArray(rawEpisodeId) ? rawEpisodeId[0] : rawEpisodeId
  const { api, offline } = useMobileApp()
  const [message, setMessage] = useState<string | null>(null)
  const load = useCallback(async (signal: AbortSignal) => {
    if (!episodeId) {
      throw new Error("This episode link is incomplete.")
    }
    return api.podcastEpisode(episodeId, { signal })
  }, [api, episodeId])
  const episode = useMobileQuery(`podcast:${episodeId ?? "missing"}`, load)

  const mutate = useCallback(async (kind: "played" | "starred") => {
    if (!episodeId || !episode.data) {
      return
    }
    const idempotencyKey = Crypto.randomUUID()
    const current = episode.data.data
    try {
      const result = await submitMobileMutation({
        offline,
        perform: () => api.updatePodcastState(episodeId, kind === "played" ? { isPlayed: !current.isPlayed } : { isStarred: !current.isStarred }, idempotencyKey),
        request: {
          body: kind === "played" ? { isPlayed: !current.isPlayed } : { isStarred: !current.isStarred },
          idempotencyKey,
          method: "PATCH",
          path: `/api/v1/podcast-episodes/${episodeId}/state`,
        },
      })
      setMessage(result.queued ? "Saved for sync when this device is online." : "Episode updated.")
      if (!result.queued) {
        episode.refresh()
      }
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Arctic RSS could not update this episode.")
    }
  }, [api, episode, episodeId, offline])

  return (
    <Screen isRefreshing={episode.isRefreshing} onRefresh={episode.refresh} title="Episode">
      {episode.error ? <Notice>{episode.error}</Notice> : null}
      {message ? <Notice tone="info">{message}</Notice> : null}
      {episode.data ? (
        <>
          <Section>
            <Text style={mobileStyles.listTitle}>{episode.data.data.title}</Text>
            <Text style={mobileStyles.muted}>{episode.data.data.podcast.title}</Text>
          </Section>
          <Section title="Episode notes">
            <Text selectable style={mobileStyles.body}>{episode.data.data.contentText ?? episode.data.data.description ?? "No episode notes are available."}</Text>
          </Section>
          <Section title="Episode status">
            <Text style={mobileStyles.muted}>In-app audio playback and listening progress are not available in this internal build.</Text>
            <ActionButton onPress={() => void mutate("played")} tone="secondary">Mark as {episode.data.data.isPlayed ? "not completed" : "completed"}</ActionButton>
            <ActionButton onPress={() => void mutate("starred")} tone="secondary">{episode.data.data.isStarred ? "Remove star" : "Star episode"}</ActionButton>
          </Section>
        </>
      ) : <Loading />}
    </Screen>
  )
}

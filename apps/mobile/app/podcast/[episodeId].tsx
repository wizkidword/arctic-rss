import { useCallback, useState } from "react"
import * as Crypto from "expo-crypto"
import { useLocalSearchParams } from "expo-router"
import { Text, TextInput } from "react-native"

import { ActionButton, Loading, Notice, Screen, Section, mobileStyles } from "@/components/mobile-ui"
import { useMobileQuery } from "@/hooks/use-mobile-query"
import { useMobileApp } from "@/providers/mobile-app-provider"
import { submitMobileMutation } from "@/sync/submit-mobile-mutation"

export default function PodcastEpisodeScreen() {
  const { episodeId: rawEpisodeId } = useLocalSearchParams<{ episodeId: string }>()
  const episodeId = Array.isArray(rawEpisodeId) ? rawEpisodeId[0] : rawEpisodeId
  const { api, offline } = useMobileApp()
  const [position, setPosition] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const load = useCallback(async () => {
    if (!episodeId) {
      throw new Error("This episode link is incomplete.")
    }
    return api.podcastEpisode(episodeId)
  }, [api, episodeId])
  const episode = useMobileQuery(`podcast:${episodeId ?? "missing"}`, load)

  const mutate = useCallback(async (kind: "played" | "starred" | "position") => {
    if (!episodeId || !episode.data) {
      return
    }
    const idempotencyKey = Crypto.randomUUID()
    const current = episode.data.data
    try {
      const result = kind === "position"
        ? await submitMobileMutation({
            offline,
            perform: () => api.updatePodcastProgress(episodeId, { playbackPositionSeconds: Number(position) }, idempotencyKey),
            request: {
              body: { playbackPositionSeconds: Number(position) },
              idempotencyKey,
              method: "PATCH",
              path: `/api/v1/podcast-episodes/${episodeId}/progress`,
            },
          })
        : await submitMobileMutation({
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
  }, [api, episode, episodeId, offline, position])

  const validPosition = /^\d+$/.test(position) && Number(position) <= 604_800

  return (
    <Screen isRefreshing={episode.isRefreshing} onRefresh={episode.refresh} title="Episode">
      {episode.error ? <Notice>{episode.error}</Notice> : null}
      {message ? <Notice tone="info">{message}</Notice> : null}
      {episode.data ? (
        <>
          <Section>
            <Text style={mobileStyles.listTitle}>{episode.data.data.title}</Text>
            <Text style={mobileStyles.muted}>{episode.data.data.podcast.title}</Text>
            <Text style={mobileStyles.muted}>Position: {episode.data.data.playbackPositionSeconds} seconds</Text>
          </Section>
          <Section title="Episode notes">
            <Text selectable style={mobileStyles.body}>{episode.data.data.contentText ?? episode.data.data.description ?? "No episode notes are available."}</Text>
          </Section>
          <Section title="Playback progress">
            <Text style={mobileStyles.muted}>This internal alpha records playback position. Native audio playback is not included in this build.</Text>
            <TextInput accessibilityLabel="Playback position in seconds" keyboardType="number-pad" onChangeText={setPosition} placeholder="Seconds listened" style={mobileStyles.input} value={position} />
            <ActionButton disabled={!validPosition} onPress={() => void mutate("position")} tone="secondary">Save position</ActionButton>
            <ActionButton onPress={() => void mutate("played")} tone="secondary">Mark as {episode.data.data.isPlayed ? "unplayed" : "played"}</ActionButton>
            <ActionButton onPress={() => void mutate("starred")} tone="secondary">{episode.data.data.isStarred ? "Remove star" : "Star episode"}</ActionButton>
          </Section>
        </>
      ) : <Loading />}
    </Screen>
  )
}

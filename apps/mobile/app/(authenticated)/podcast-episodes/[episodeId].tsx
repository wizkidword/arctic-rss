import { Redirect, useLocalSearchParams } from "expo-router"

export default function LegacyPodcastEpisodeRoute() {
  const { episodeId } = useLocalSearchParams<{ episodeId: string }>()
  return <Redirect href={{ pathname: "/podcast/[episodeId]", params: { episodeId: Array.isArray(episodeId) ? episodeId[0] : episodeId } }} />
}

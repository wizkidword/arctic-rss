import { Redirect, useLocalSearchParams } from "expo-router"

export default function LegacyBriefingRoute() {
  const { briefingId } = useLocalSearchParams<{ briefingId: string }>()
  return <Redirect href={{ pathname: "/briefing/[briefingId]", params: { briefingId: Array.isArray(briefingId) ? briefingId[0] : briefingId } }} />
}

import { Redirect, useLocalSearchParams } from "expo-router"

export default function LegacySavedViewRoute() {
  const { savedViewId } = useLocalSearchParams<{ savedViewId: string }>()
  return <Redirect href={{ pathname: "/saved-view/[savedViewId]", params: { savedViewId: Array.isArray(savedViewId) ? savedViewId[0] : savedViewId } }} />
}

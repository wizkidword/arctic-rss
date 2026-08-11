import { Redirect, Stack, usePathname } from "expo-router"

import { useMobileApp } from "@/providers/mobile-app-provider"

export default function AuthenticatedLayout() {
  const { isSignedIn } = useMobileApp()
  const pathname = usePathname()

  if (!isSignedIn) {
    return <Redirect href={{ pathname: "/", params: { returnTo: pathname } }} />
  }

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="article/[articleId]" options={{ title: "Article" }} />
      <Stack.Screen name="podcast/[episodeId]" options={{ title: "Episode" }} />
      <Stack.Screen name="collection/[collectionId]" options={{ title: "Collection" }} />
      <Stack.Screen name="saved-view/[savedViewId]" options={{ title: "Saved view" }} />
      <Stack.Screen name="briefing/[briefingId]" options={{ title: "Briefing" }} />
      <Stack.Screen name="collection-picker" options={{ title: "Save to collection" }} />
      <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
      <Stack.Screen name="offline-changes" options={{ title: "Offline changes need attention" }} />
      <Stack.Screen name="support" options={{ title: "Support" }} />
      <Stack.Screen name="articles/[articleId]" options={{ title: "Article" }} />
      <Stack.Screen name="podcast-episodes/[episodeId]" options={{ title: "Episode" }} />
      <Stack.Screen name="collections/[collectionId]" options={{ title: "Collection" }} />
      <Stack.Screen name="saved-views/[savedViewId]" options={{ title: "Saved view" }} />
      <Stack.Screen name="briefings/[briefingId]" options={{ title: "Briefing" }} />
    </Stack>
  )
}

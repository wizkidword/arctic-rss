import { Tabs } from "expo-router"

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: "Articles" }} />
      <Tabs.Screen name="search" options={{ title: "Search" }} />
      <Tabs.Screen name="library" options={{ title: "Library" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
      <Tabs.Screen name="unread" options={{ href: null }} />
      <Tabs.Screen name="starred" options={{ href: null }} />
    </Tabs>
  )
}

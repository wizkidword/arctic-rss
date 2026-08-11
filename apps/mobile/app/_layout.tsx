import { Stack } from "expo-router"
import { StatusBar } from "expo-status-bar"

import { MobileAppProvider } from "@/providers/mobile-app-provider"

export default function RootLayout() {
  return (
    <MobileAppProvider>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(authenticated)" options={{ headerShown: false }} />
        <Stack.Screen name="mobile/auth/callback" options={{ title: "Sign in" }} />
      </Stack>
    </MobileAppProvider>
  )
}

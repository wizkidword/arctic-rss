import { Stack } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { Text, View } from "react-native"

import { MOBILE_BUILD_ENVIRONMENT } from "@/config"
import { MobileAppProvider } from "@/providers/mobile-app-provider"

export default function RootLayout() {
  return (
    <MobileAppProvider>
      <StatusBar style="auto" />
      {MOBILE_BUILD_ENVIRONMENT !== "production" ? (
        <View accessibilityLabel={`Arctic RSS ${MOBILE_BUILD_ENVIRONMENT} environment`} style={{ backgroundColor: "#183a4a", padding: 6 }}>
          <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "700", textAlign: "center" }}>{MOBILE_BUILD_ENVIRONMENT.toUpperCase()} BUILD</Text>
        </View>
      ) : null}
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(authenticated)" options={{ headerShown: false }} />
        <Stack.Screen name="mobile/auth/callback" options={{ title: "Sign in" }} />
      </Stack>
    </MobileAppProvider>
  )
}

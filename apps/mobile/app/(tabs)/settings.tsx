import { useCallback } from "react"
import { router } from "expo-router"
import { Text } from "react-native"

import { ActionButton, Loading, Notice, Screen, Section, mobileStyles } from "@/components/mobile-ui"
import { MOBILE_WEB_LINKS } from "@/config"
import { useMobileQuery } from "@/hooks/use-mobile-query"
import { useMobileApp } from "@/providers/mobile-app-provider"
import { openArcticRssWebPath } from "@/web-links"

export default function SettingsScreen() {
  const { api, offline, signOut } = useMobileApp()
  const { data, error } = useMobileQuery("me", useCallback(() => api.me(), [api]))

  return (
    <Screen title="Settings">
      {error ? <Notice>{error}</Notice> : null}
      <Section title="Account">
        {data ? <Text style={mobileStyles.muted}>{data.data.name ?? data.data.email} · {data.data.plan}</Text> : <Loading />}
        <ActionButton onPress={() => router.push("/notifications")} tone="secondary">Notification preferences</ActionButton>
        <ActionButton onPress={() => void openArcticRssWebPath(MOBILE_WEB_LINKS.deviceManagement)} tone="secondary">Manage devices on web</ActionButton>
      </Section>
      <Section title="Downloaded data">
        <Text style={mobileStyles.muted}>Recently opened articles and the local sync cursor stay on this device only.</Text>
        <ActionButton onPress={() => void offline.clearDownloadedData()} tone="secondary">Clear downloaded data</ActionButton>
      </Section>
      <Section title="Privacy and support">
        <ActionButton onPress={() => void openArcticRssWebPath(MOBILE_WEB_LINKS.privacy)} tone="secondary">Privacy</ActionButton>
        <ActionButton onPress={() => router.push("/support")} tone="secondary">Support</ActionButton>
        <ActionButton onPress={() => void openArcticRssWebPath(MOBILE_WEB_LINKS.accountDeletion)} tone="secondary">Delete account</ActionButton>
      </Section>
      <ActionButton onPress={() => void signOut()} tone="danger">Sign out and clear this device</ActionButton>
    </Screen>
  )
}

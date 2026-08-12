import { useCallback, useEffect, useState } from "react"
import { router } from "expo-router"
import { Text } from "react-native"

import { ActionButton, Loading, Notice, Screen, Section, mobileStyles } from "@/components/mobile-ui"
import { MOBILE_WEB_LINKS } from "@/config"
import { useMobileQuery } from "@/hooks/use-mobile-query"
import { useMobileApp } from "@/providers/mobile-app-provider"
import { openArcticRssWebPath } from "@/web-links"

export default function SettingsScreen() {
  const { api, offline, signOut, syncNow, syncSnapshot } = useMobileApp()
  const [offlineSummary, setOfflineSummary] = useState<string>("Checking local storage…")
  const refreshOfflineSummary = useCallback(() => {
    void offline.offlineStatus().then((status) => {
      setOfflineSummary(`${status.cachedEntries} cached item${status.cachedEntries === 1 ? "" : "s"} · ${(status.cachedBytes / (1024 * 1024)).toFixed(1)} MB · ${status.selectedCollectionIds.length} selected collection${status.selectedCollectionIds.length === 1 ? "" : "s"}`)
    }).catch(() => {
      setOfflineSummary("Local storage status is unavailable until this device is ready.")
    })
  }, [offline])
  useEffect(() => {
    refreshOfflineSummary()
  }, [refreshOfflineSummary])
  const { data, error } = useMobileQuery(
    "me",
    useCallback((signal: AbortSignal) => api.me({ signal }), [api])
  )

  return (
    <Screen title="Settings">
      {error ? <Notice>{error}</Notice> : null}
      <Section title="Account">
        {data ? <Text style={mobileStyles.muted}>{data.data.name ?? data.data.email} · {data.data.plan}</Text> : <Loading />}
        <ActionButton onPress={() => router.push("/notifications")} tone="secondary">Notification preferences</ActionButton>
        <ActionButton onPress={() => router.push("/offline-changes")} tone="secondary">Offline changes need attention</ActionButton>
        <ActionButton onPress={() => void openArcticRssWebPath(MOBILE_WEB_LINKS.deviceManagement)} tone="secondary">Manage devices on web</ActionButton>
      </Section>
      <Section title="Downloaded data">
        <Text style={mobileStyles.muted}>Starred and recently opened articles, plus selected collections you open, stay on this device only within a 20 MB local limit.</Text>
        <Text style={mobileStyles.muted}>{offlineSummary}</Text>
        <Text style={mobileStyles.muted}>Last sync: {syncSnapshot.lastSuccessfulSyncAt ? new Date(syncSnapshot.lastSuccessfulSyncAt).toLocaleString() : "not completed yet"}.</Text>
        <ActionButton onPress={() => void syncNow().finally(refreshOfflineSummary)} tone="secondary">Sync now</ActionButton>
        <ActionButton onPress={() => void offline.clearDownloadedData().then(refreshOfflineSummary)} tone="secondary">Clear downloaded data</ActionButton>
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

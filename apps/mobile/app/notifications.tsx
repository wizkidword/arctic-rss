import { useCallback, useState } from "react"
import * as Crypto from "expo-crypto"
import { Text, View } from "react-native"

import type { NotificationChannel, NotificationTopic } from "@arctic-rss/api-contract"

import { ActionButton, Loading, Notice, Screen, Section, mobileStyles } from "@/components/mobile-ui"
import { useMobileQuery } from "@/hooks/use-mobile-query"
import { useMobileApp } from "@/providers/mobile-app-provider"
import { submitMobileMutation } from "@/sync/submit-mobile-mutation"

const channels: readonly NotificationChannel[] = ["IN_APP", "EMAIL", "MOBILE_PUSH", "DISABLED"]

function nextChannel(channel: NotificationChannel) {
  return channels[(channels.indexOf(channel) + 1) % channels.length]
}

export default function NotificationsScreen() {
  const { api, offline } = useMobileApp()
  const [message, setMessage] = useState<string | null>(null)
  const preferences = useMobileQuery(
    "notification-preferences",
    useCallback(() => api.notificationPreferences(), [api])
  )
  const update = useCallback(async (topic: NotificationTopic, channel: NotificationChannel) => {
    const idempotencyKey = Crypto.randomUUID()
    try {
      const result = await submitMobileMutation({
        offline,
        perform: () => api.updateNotificationPreference(topic, channel, idempotencyKey),
        request: {
          body: { channel },
          idempotencyKey,
          method: "PUT",
          path: `/api/v1/notification-preferences/${topic}`,
        },
      })
      setMessage(result.queued ? "Preference saved for sync when this device is online." : "Notification preference updated.")
      if (!result.queued) {
        preferences.refresh()
      }
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Arctic RSS could not update this preference.")
    }
  }, [api, offline, preferences])

  return (
    <Screen isRefreshing={preferences.isRefreshing} onRefresh={preferences.refresh} title="Notifications">
      {preferences.error ? <Notice>{preferences.error}</Notice> : null}
      {message ? <Notice tone="info">{message}</Notice> : null}
      <Section>
        <Text style={mobileStyles.muted}>Tap a topic to cycle its delivery setting. Push delivery stays disabled until a future signed build registers a push token.</Text>
      </Section>
      {preferences.data ? preferences.data.data.preferences.map((preference) => {
        const next = nextChannel(preference.channel)
        return (
          <Section key={preference.topic} title={preference.topic.replaceAll("_", " ")}>
            <View style={mobileStyles.actionRow}>
              <Text style={mobileStyles.muted}>Current: {preference.channel.replaceAll("_", " ")}</Text>
              <ActionButton onPress={() => void update(preference.topic, next)} tone="secondary">Use {next.replaceAll("_", " ")}</ActionButton>
            </View>
          </Section>
        )
      }) : <Loading />}
    </Screen>
  )
}

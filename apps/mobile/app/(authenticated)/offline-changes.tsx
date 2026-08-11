import { useCallback, useState } from "react"
import { router } from "expo-router"
import { Text } from "react-native"

import { type PendingMobileMutation } from "@arctic-rss/mobile-client"

import { ActionButton, Loading, Notice, Screen, Section, mobileStyles } from "@/components/mobile-ui"
import { useMobileQuery } from "@/hooks/use-mobile-query"
import { useMobileApp } from "@/providers/mobile-app-provider"
import {
  mobileMutationLabel,
  mobileMutationReason,
  mobileMutationResourcePath,
} from "@/sync/mobile-mutation-presentation"

export default function OfflineChangesScreen() {
  const { offline, syncNow, syncSnapshot } = useMobileApp()
  const [message, setMessage] = useState<string | null>(null)
  const changes = useMobileQuery(
    "offline-conflicts",
    useCallback(() => offline.conflictMutations(), [offline])
  )

  const retry = useCallback(async (mutation: PendingMobileMutation) => {
    try {
      await offline.retryTerminalPendingMutation(mutation.idempotencyKey)
      await syncNow()
      setMessage("Offline changes were retried.")
      changes.refresh()
    } catch {
      setMessage("This offline change could not be updated. Try again from this device.")
    }
  }, [changes, offline, syncNow])

  const discard = useCallback(async (mutation: PendingMobileMutation) => {
    try {
      await offline.removePendingMutation(mutation.idempotencyKey)
      setMessage("The saved offline change was discarded on this device.")
      changes.refresh()
    } catch {
      setMessage("This offline change could not be discarded. Try again from this device.")
    }
  }, [changes, offline])

  return (
    <Screen isRefreshing={changes.isRefreshing} onRefresh={changes.refresh} title="Offline changes need attention">
      <Section>
        <Text style={mobileStyles.muted}>These changes were not silently removed. Review, retry, or discard each one on this device.</Text>
        <Text style={mobileStyles.muted}>Sync status: {mobileSyncStatus(syncSnapshot.state)}.</Text>
      </Section>
      {message ? <Notice tone="info">{message}</Notice> : null}
      {changes.error ? <Notice>{changes.error}</Notice> : null}
      {changes.data === null ? <Loading /> : null}
      {changes.data?.length === 0 ? <Notice tone="info">No offline changes need attention.</Notice> : null}
      {changes.data?.map((mutation) => (
        <Section key={mutation.id} title={mobileMutationLabel(mutation)}>
          <Text style={mobileStyles.muted}>{mobileMutationReason(mutation)}</Text>
          <ActionButton onPress={() => void retry(mutation)} tone="secondary">Retry</ActionButton>
          <ActionButton onPress={() => router.push(mobileMutationResourcePath(mutation))} tone="secondary">Open item</ActionButton>
          <ActionButton onPress={() => void discard(mutation)} tone="danger">Discard</ActionButton>
        </Section>
      ))}
    </Screen>
  )
}

function mobileSyncStatus(state: "auth-required" | "conflicts" | "idle" | "offline" | "syncing") {
  if (state === "auth-required") return "sign in required"
  if (state === "conflicts") return "conflicts need attention"
  if (state === "offline") return "offline; saved changes will retry"
  if (state === "syncing") return "syncing"
  return "up to date"
}

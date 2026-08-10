import { useCallback, useState } from "react"
import * as Crypto from "expo-crypto"
import { router, useLocalSearchParams } from "expo-router"
import { Text } from "react-native"

import { ActionButton, Loading, Notice, Screen, Section, mobileStyles } from "@/components/mobile-ui"
import { useMobileQuery } from "@/hooks/use-mobile-query"
import { useMobileApp } from "@/providers/mobile-app-provider"
import { submitMobileMutation } from "@/sync/submit-mobile-mutation"

export default function CollectionPickerScreen() {
  const { articleId: rawArticleId } = useLocalSearchParams<{ articleId: string }>()
  const articleId = Array.isArray(rawArticleId) ? rawArticleId[0] : rawArticleId
  const { api, offline } = useMobileApp()
  const [message, setMessage] = useState<string | null>(null)
  const { data, error, isRefreshing, refresh } = useMobileQuery(
    "collections",
    useCallback(() => api.collections(), [api])
  )
  const add = useCallback(async (collectionId: string) => {
    if (!articleId) {
      setMessage("This article link is incomplete.")
      return
    }
    const idempotencyKey = Crypto.randomUUID()
    try {
      const result = await submitMobileMutation({
        offline,
        perform: () => api.addCollectionItem(collectionId, articleId, idempotencyKey),
        request: {
          body: { articleId },
          idempotencyKey,
          method: "POST",
          path: `/api/v1/collections/${collectionId}/items`,
        },
      })
      setMessage(result.queued ? "Saved for sync when this device is online." : "Saved to collection.")
      if (!result.queued) {
        router.back()
      }
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Arctic RSS could not update this collection.")
    }
  }, [api, articleId, offline])

  return (
    <Screen isRefreshing={isRefreshing} onRefresh={refresh} title="Save to collection">
      {error ? <Notice>{error}</Notice> : null}
      {message ? <Notice tone="info">{message}</Notice> : null}
      <Section>
        {data ? data.data.collections.length ? data.data.collections.map((collection) => (
          <ActionButton key={collection.id} onPress={() => void add(collection.id)} tone="secondary">{collection.name} · {collection.itemCount} items</ActionButton>
        )) : <Text style={mobileStyles.muted}>Create collections on the web, then return here to save articles.</Text> : <Loading />}
      </Section>
    </Screen>
  )
}

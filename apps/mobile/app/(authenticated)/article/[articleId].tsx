import { useCallback, useState } from "react"
import * as Crypto from "expo-crypto"
import { router, useLocalSearchParams } from "expo-router"
import { Text } from "react-native"

import { ActionButton, Loading, Notice, Screen, Section, mobileStyles } from "@/components/mobile-ui"
import { useMobileQuery } from "@/hooks/use-mobile-query"
import { useMobileApp } from "@/providers/mobile-app-provider"
import { submitMobileMutation } from "@/sync/submit-mobile-mutation"

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default function ArticleScreen() {
  const params = useLocalSearchParams<{ articleId: string; collectionId?: string }>()
  const articleId = single(params.articleId)
  const collectionId = single(params.collectionId)
  const { api, offline } = useMobileApp()
  const [message, setMessage] = useState<string | null>(null)
  const load = useCallback(async () => {
    if (!articleId) {
      throw new Error("This article link is incomplete.")
    }
    return api.article(articleId)
  }, [api, articleId])
  const { data, error, hasOfflineCopy, isRefreshing, refresh } = useMobileQuery(`article:${articleId ?? "missing"}`, load)

  const updateState = useCallback(
    async (input: { isArchived?: boolean; isRead?: boolean; isStarred?: boolean }) => {
      if (!articleId) {
        return
      }
      const idempotencyKey = Crypto.randomUUID()
      try {
        const result = await submitMobileMutation({
          offline,
          perform: () => api.updateArticleState(articleId, input, idempotencyKey),
          request: {
            body: input,
            idempotencyKey,
            method: "PATCH",
            path: `/api/v1/articles/${articleId}/state`,
          },
        })
        setMessage(result.queued ? "Saved for sync when this device is online." : "Article updated.")
        if (!result.queued) {
          refresh()
        }
      } catch (caught) {
        setMessage(caught instanceof Error ? caught.message : "Arctic RSS could not update this article.")
      }
    },
    [api, articleId, offline, refresh]
  )

  const removeFromCollection = useCallback(async () => {
    if (!articleId || !collectionId) {
      return
    }
    const idempotencyKey = Crypto.randomUUID()
    try {
      const result = await submitMobileMutation({
        offline,
        perform: () => api.removeCollectionItem(collectionId, articleId, idempotencyKey),
        request: {
          idempotencyKey,
          method: "DELETE",
          path: `/api/v1/collections/${collectionId}/items/${articleId}`,
        },
      })
      setMessage(result.queued ? "Removal saved for sync when this device is online." : "Removed from collection.")
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Arctic RSS could not update this collection.")
    }
  }, [api, articleId, collectionId, offline])

  return (
    <Screen isRefreshing={isRefreshing} onRefresh={refresh} title="Article">
      {error ? <Notice>{error}</Notice> : null}
      {message ? <Notice tone="info">{message}</Notice> : null}
      {data ? (
        <>
          <Section>
            <Text style={mobileStyles.listTitle}>{data.data.title}</Text>
            <Text style={mobileStyles.muted}>{data.data.feed.title}</Text>
            {data.data.author ? <Text style={mobileStyles.muted}>By {data.data.author}</Text> : null}
          </Section>
          <Section title="Reader view">
            <Text selectable style={mobileStyles.body}>{data.data.contentText ?? data.data.summary ?? "No reader text is available for this article."}</Text>
            <Text style={mobileStyles.muted}>
              {hasOfflineCopy
                ? "Reader copy saved on this device for offline reading."
                : "Reader copy will be saved on this device when available."}
            </Text>
          </Section>
          <Section title="Article actions">
            <ActionButton onPress={() => void updateState({ isRead: !data.data.isRead })} tone="secondary">Mark as {data.data.isRead ? "unread" : "read"}</ActionButton>
            <ActionButton onPress={() => void updateState({ isStarred: !data.data.isStarred })} tone="secondary">{data.data.isStarred ? "Remove star" : "Star article"}</ActionButton>
            <ActionButton onPress={() => router.push({ pathname: "/collection-picker", params: { articleId: data.data.id } })} tone="secondary">Save to collection</ActionButton>
            {collectionId ? <ActionButton onPress={() => void removeFromCollection()} tone="secondary">Remove from this collection</ActionButton> : null}
            <ActionButton onPress={() => void updateState({ isArchived: true })} tone="danger">Archive article</ActionButton>
          </Section>
        </>
      ) : <Loading />}
    </Screen>
  )
}

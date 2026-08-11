import { useCallback } from "react"
import { router, useLocalSearchParams } from "expo-router"
import { Pressable, Text } from "react-native"

import { Loading, Notice, Screen, Section, mobileStyles } from "@/components/mobile-ui"
import { useMobileQuery } from "@/hooks/use-mobile-query"
import { useMobileApp } from "@/providers/mobile-app-provider"

export default function BriefingScreen() {
  const { briefingId: rawBriefingId } = useLocalSearchParams<{ briefingId: string }>()
  const briefingId = Array.isArray(rawBriefingId) ? rawBriefingId[0] : rawBriefingId
  const { api } = useMobileApp()
  const load = useCallback(async () => {
    if (!briefingId) {
      throw new Error("This briefing link is incomplete.")
    }
    return api.briefing(briefingId)
  }, [api, briefingId])
  const briefing = useMobileQuery(`briefing:${briefingId ?? "missing"}`, load)

  return (
    <Screen isRefreshing={briefing.isRefreshing} onRefresh={briefing.refresh} title="Briefing">
      {briefing.error ? <Notice>{briefing.error}</Notice> : null}
      {briefing.data ? (
        <>
          <Section>
            <Text style={mobileStyles.listTitle}>{briefing.data.data.title}</Text>
            <Text style={mobileStyles.muted}>{briefing.data.data.rule.name} · {briefing.data.data.status.replaceAll("_", " ")}</Text>
            {briefing.data.data.errorMessage ? <Notice>{briefing.data.data.errorMessage}</Notice> : null}
            {briefing.data.data.topicPrompt ? <Text style={mobileStyles.muted}>{briefing.data.data.topicPrompt}</Text> : null}
          </Section>
          <Section title="Briefing items">
            {briefing.data.data.items.length ? briefing.data.data.items.map((item) => (
              <Pressable
                accessibilityLabel={`Open briefing item ${item.articleTitle}`}
                key={item.id}
                onPress={() => item.articleId ? router.push({ pathname: "/article/[articleId]", params: { articleId: item.articleId } }) : undefined}
                style={mobileStyles.listItem}
              >
                <Text style={mobileStyles.listTitle}>{item.articleTitle}</Text>
                <Text style={mobileStyles.muted}>{item.feedTitle}</Text>
                <Text style={mobileStyles.muted}>{item.summary}</Text>
                {item.reason ? <Text style={mobileStyles.muted}>Why this appeared: {item.reason}</Text> : null}
              </Pressable>
            )) : <Text style={mobileStyles.muted}>This briefing has no matching articles.</Text>}
          </Section>
        </>
      ) : <Loading />}
    </Screen>
  )
}

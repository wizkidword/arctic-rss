import { useCallback, useState } from "react"
import { Text, TextInput } from "react-native"

import { ArticleList } from "@/components/article-list"
import { ActionButton, Loading, Notice, Screen, Section, mobileStyles } from "@/components/mobile-ui"
import { useMobileQuery } from "@/hooks/use-mobile-query"
import { useMobileApp } from "@/providers/mobile-app-provider"

export default function SearchScreen() {
  const { api } = useMobileApp()
  const [draft, setDraft] = useState("")
  const [query, setQuery] = useState("")
  const load = useCallback(() => api.search({ limit: 30, q: query }), [api, query])
  const { data, error, isRefreshing, refresh } = useMobileQuery(`search:${query}`, load)

  return (
    <Screen isRefreshing={isRefreshing} onRefresh={refresh} title="Search">
      <Section title="Your articles">
        <TextInput
          accessibilityLabel="Search your articles"
          autoCapitalize="none"
          onChangeText={setDraft}
          onSubmitEditing={() => setQuery(draft.trim())}
          placeholder="Search titles and summaries"
          returnKeyType="search"
          style={{ backgroundColor: "#f1f5f7", borderRadius: 8, minHeight: 44, paddingHorizontal: 12 }}
          value={draft}
        />
        <ActionButton onPress={() => setQuery(draft.trim())}>Search</ActionButton>
      </Section>
      {error ? <Notice>{error}</Notice> : null}
      <Section>
        {data ? data.data.articles.length ? <ArticleList articles={data.data.articles} /> : <Text style={mobileStyles.muted}>No articles match this search.</Text> : <Loading />}
      </Section>
    </Screen>
  )
}

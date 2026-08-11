import { useCallback, useState } from "react"
import { Text, TextInput } from "react-native"

import { ArticleList } from "@/components/article-list"
import { ActionButton, Loading, Notice, Screen, Section, mobileStyles } from "@/components/mobile-ui"
import { useMobilePagination } from "@/hooks/use-mobile-pagination"
import { useMobileApp } from "@/providers/mobile-app-provider"

export default function SearchScreen() {
  const { api } = useMobileApp()
  const [draft, setDraft] = useState("")
  const [query, setQuery] = useState("")
  const load = useCallback(
    ({ cursor, signal }: { cursor?: string; signal: AbortSignal }) =>
      api.search({ cursor, limit: 30, q: query }, { signal }),
    [api, query]
  )
  const page = useMobilePagination(
    `search:${query}`,
    load,
    useCallback((response) => response.data.articles, []),
    useCallback((article) => article.id, [])
  )

  return (
    <Screen isRefreshing={page.isRefreshing} onRefresh={page.refresh} title="Search">
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
      {page.error ? <Notice>{page.error}</Notice> : null}
      <Section>
        {page.items.length ? <ArticleList articles={page.items} /> : page.isRefreshing ? <Loading /> : <Text style={mobileStyles.muted}>No articles match this search.</Text>}
        {page.hasNextPage ? <ActionButton disabled={page.isLoadingMore} onPress={() => void page.loadMore()} tone="secondary">{page.isLoadingMore ? "Loading more articles…" : "Load more articles"}</ActionButton> : null}
        {page.isTruncated ? <Notice tone="info">Showing the first 300 articles. Refine your search to load a smaller result set.</Notice> : null}
        {!page.hasNextPage && page.items.length > 0 && !page.isTruncated ? <Text style={mobileStyles.muted}>You have reached the end of these results.</Text> : null}
      </Section>
    </Screen>
  )
}

import type { ArticleListItem } from "@arctic-rss/api-contract"
import { router } from "expo-router"
import { Pressable, Text, View } from "react-native"

import { mobileStyles } from "@/components/mobile-ui"

export function ArticleList({
  articles,
  collectionId,
}: {
  articles: ArticleListItem[]
  collectionId?: string
}) {
  return (
    <View>
      {articles.map((article) => (
        <Pressable
          accessibilityLabel={`Open article ${article.title}`}
          key={article.id}
          onPress={() =>
            router.push({
              pathname: "/article/[articleId]",
              params: { articleId: article.id, ...(collectionId ? { collectionId } : {}) },
            })
          }
          style={mobileStyles.listItem}
        >
          <Text style={mobileStyles.listTitle}>{article.title}</Text>
          <Text style={mobileStyles.muted}>{article.feed.title}{article.isRead ? " · Read" : " · Unread"}{article.isStarred ? " · Starred" : ""}</Text>
          {article.summary ? <Text numberOfLines={3} style={mobileStyles.muted}>{article.summary}</Text> : null}
        </Pressable>
      ))}
    </View>
  )
}

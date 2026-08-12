import { Redirect, useLocalSearchParams } from "expo-router"

export default function LegacyArticleRoute() {
  const { articleId } = useLocalSearchParams<{ articleId: string }>()
  return <Redirect href={{ pathname: "/article/[articleId]", params: { articleId: Array.isArray(articleId) ? articleId[0] : articleId } }} />
}

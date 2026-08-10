import type { ArticleListItem } from "./articles"
import type { Me } from "./account"

export const apiV1FixtureRequestId = "11111111-1111-4111-8111-111111111111"

export const apiV1FixtureArticleListItem: ArticleListItem = {
  feed: {
    faviconUrl: "https://cdn.example.test/feed.png",
    id: "feed_1",
    title: "Example Feed",
  },
  id: "article_1",
  imageUrl: "https://cdn.example.test/article.png",
  isRead: false,
  isStarred: true,
  publishedAt: "2026-08-10T12:00:00.000Z",
  summary: "A bounded summary.",
  title: "An example article",
  url: "https://example.test/articles/1",
}

export const apiV1FixtureMe: Me = {
  email: "reader@example.test",
  id: "user_1",
  name: "Reader",
  plan: "FREE",
}

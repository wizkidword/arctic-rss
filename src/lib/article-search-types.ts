export const ARTICLE_SEARCH_QUERY_VERSION = 1

export type ArticleSearchState = "all" | "read" | "starred" | "unread"

export type ArticleSearchFilters = {
  after?: string
  collectionId?: string
  folderId?: string
  publishedAfter?: Date
  publishedBefore?: Date
  query: string
  state: ArticleSearchState
  subscriptionId?: string
}

export type ArticleSearchParams = Record<
  string,
  string | string[] | undefined
>

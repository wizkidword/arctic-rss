import Link from "next/link"

import {
  ArticleContextMenu,
  type ActiveArticleCollection,
  type ArticleContextMenuArticle,
} from "@/components/article-context-menu"
import { ArticleStateControls } from "@/components/article-state-controls"
import { type ReaderArticleListItem } from "@/lib/articles"
import { imageProxyUrl } from "@/lib/image-proxy-url"
import { articleSelectionHref } from "@/lib/reader-navigation"
import { formatArticleDateTime, type DateTimePreferences } from "@/lib/settings"
import { type ArticleCollectionPickerItem } from "@/lib/article-collections"
import { cn } from "@/lib/utils"

export function ArticleCardGrid({
  articles,
  articleCollections,
  basePath,
  currentCollection,
  dateTimePreferences,
  readOnlyActionReason,
  selectedArticleId,
}: {
  articles: ReaderArticleListItem[]
  articleCollections: ArticleCollectionPickerItem[]
  basePath: string
  currentCollection?: ActiveArticleCollection
  dateTimePreferences: DateTimePreferences
  readOnlyActionReason?: string
  selectedArticleId?: string
}) {
  return (
    <div className="grid content-start gap-3 sm:grid-cols-2">
      {articles.map((article) => (
        <ArticleContextMenu
          article={articleContextMenuArticle(article)}
          as="article"
          collections={articleCollections}
          currentCollection={currentCollection}
          readOnlyReason={readOnlyActionReason}
          className={cn(
            "overflow-hidden rounded-lg border bg-card transition-colors hover:bg-muted",
            article.id === selectedArticleId && "bg-muted"
          )}
          inlineActions
          key={article.id}
        >
          {imageProxyUrl(article.imageUrl) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt=""
              className="aspect-video w-full object-cover"
              src={imageProxyUrl(article.imageUrl) ?? ""}
            />
          )}
          <div className="flex flex-col gap-3 p-3">
            <Link className="min-w-0" href={articleSelectionHref(basePath, article.id)}>
              <h2
                className={cn(
                  "line-clamp-2 text-sm leading-5",
                  !article.isRead && "font-semibold"
                )}
              >
                {article.title}
              </h2>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {article.feedTitle}
                {article.publishedAt
                  ? ` - ${formatArticleDateTime(
                      article.publishedAt,
                      dateTimePreferences
                    )}`
                  : ""}
              </p>
            </Link>
            {article.summary && (
              <p className="line-clamp-3 text-xs leading-5 text-muted-foreground">
                {article.summary}
              </p>
            )}
            <ArticleStateControls
              article={article}
              readOnlyReason={readOnlyActionReason}
              size="xs"
            />
          </div>
        </ArticleContextMenu>
      ))}
    </div>
  )
}

export function articleContextMenuArticle(
  article: ReaderArticleListItem
): ArticleContextMenuArticle {
  return {
    feedId: article.feedId,
    id: article.id,
    isRead: article.isRead,
    isStarred: article.isStarred,
    title: article.title,
    url: article.url,
  }
}

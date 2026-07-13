import Link from "next/link"
import { ExternalLinkIcon, LinkIcon, StarIcon } from "lucide-react"

import { ArticleAiSummaryPanel } from "@/components/article-ai-summary-panel"
import {
  ArticleActionToolbar,
  ArticleContextMenu,
  type ActiveArticleCollection,
  type ArticleContextMenuArticle,
} from "@/components/article-context-menu"
import { ArticleSourceIcon } from "@/components/article-source-icon"
import { ArticleReadTracker } from "@/components/article-read-tracker"
import {
  ArticleStateControls,
  MarkAllReadButton,
} from "@/components/article-state-controls"
import { ReaderKeyboardShortcuts } from "@/components/reader-keyboard-shortcuts"
import { ReaderViewSwitcher } from "@/components/reader-view-switcher"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { type ArticleReadScope, type ReaderArticle } from "@/lib/articles"
import { imageProxyUrl } from "@/lib/image-proxy-url"
import { type DefaultView } from "@/lib/preferences"
import {
  articleDetailHref,
  articleSelectionHref,
} from "@/lib/reader-navigation"
import {
  formatArticleDateTime,
  normalizeDateTimePreferences,
  type DateTimePreferences,
  type DisplayMode,
} from "@/lib/settings"
import { type ArticleCollectionPickerItem } from "@/lib/article-collections"
import { extractYouTubeVideoId } from "@/lib/youtube-feeds"
import { cn } from "@/lib/utils"

const ARTICLE_IMAGE_HTML_PATTERN = /<img\b/i

export function ReaderSurface({
  articles,
  articleCollections = [],
  basePath,
  currentCollection,
  dateTimePreferences,
  defaultView,
  displayMode = "THREE_PANE",
  description,
  emptyMessage,
  markAllReadScope,
  nextPageHref,
  readOnlyActionReason,
  selectedArticleId,
  title,
  toolbar,
}: {
  articles: ReaderArticle[]
  articleCollections?: ArticleCollectionPickerItem[]
  basePath: string
  currentCollection?: ActiveArticleCollection
  dateTimePreferences?: DateTimePreferences
  defaultView: DefaultView
  displayMode?: DisplayMode
  description: string
  emptyMessage: string
  markAllReadScope?: ArticleReadScope
  nextPageHref?: string
  readOnlyActionReason?: string
  selectedArticleId?: string
  title: string
  toolbar?: React.ReactNode
}) {
  const explicitlySelectedArticle = selectedArticleId
    ? articles.find((article) => article.id === selectedArticleId)
    : undefined
  const selectedArticle = explicitlySelectedArticle ?? articles[0]
  const normalizedDateTimePreferences =
    normalizeDateTimePreferences(dateTimePreferences)
  const keyboardArticles = articles.map((article) => ({
    id: article.id,
    isRead: article.isRead,
    isStarred: article.isStarred,
    url: article.url,
  }))
  const headerToolbar = (
    <div className="flex flex-col gap-2 sm:items-end">
      {displayMode !== "READER" && (
        <ReaderViewSwitcher defaultView={defaultView} />
      )}
      <div className="flex flex-wrap gap-2 sm:justify-end">
        {markAllReadScope && (
          <MarkAllReadButton
            disabled={!articles.length}
            readOnlyReason={readOnlyActionReason}
            scope={markAllReadScope}
          />
        )}
        {toolbar}
      </div>
    </div>
  )

  return (
    <div
      className="flex min-h-screen min-w-0 flex-col gap-4 overflow-x-hidden p-3 sm:p-4 lg:p-6"
      data-reader-display-mode={displayMode.toLowerCase().replace("_", "-")}
    >
      <ReaderKeyboardShortcuts
        articles={keyboardArticles}
        basePath={basePath}
        readOnlyActionReason={readOnlyActionReason}
        selectedArticleId={selectedArticle?.id}
      />
      <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-xl font-semibold">{title}</h1>
            <Badge variant="secondary">
              {articles.length} {articles.length === 1 ? "article" : "articles"}
            </Badge>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {description}
          </p>
        </div>
        {headerToolbar}
      </section>

      {renderReaderView({
        articleCollections,
        articles,
        basePath,
        currentCollection,
        dateTimePreferences: normalizedDateTimePreferences,
        defaultView,
        displayMode,
        emptyMessage,
        hasExplicitSelection: Boolean(explicitlySelectedArticle),
        readOnlyActionReason,
        selectedArticle,
        trackSelectedArticleRead:
          Boolean(explicitlySelectedArticle) && !readOnlyActionReason,
      })}
      {nextPageHref ? (
        <nav aria-label="Article pagination" className="flex justify-center pb-4">
          <Link
            className="rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
            href={nextPageHref}
          >
            Older articles
          </Link>
        </nav>
      ) : null}
    </div>
  )
}

function renderReaderView({
  articleCollections,
  articles,
  basePath,
  currentCollection,
  dateTimePreferences,
  defaultView,
  displayMode,
  emptyMessage,
  hasExplicitSelection,
  readOnlyActionReason,
  selectedArticle,
  trackSelectedArticleRead,
}: {
  articleCollections: ArticleCollectionPickerItem[]
  articles: ReaderArticle[]
  basePath: string
  currentCollection?: ActiveArticleCollection
  dateTimePreferences: DateTimePreferences
  defaultView: DefaultView
  displayMode: DisplayMode
  emptyMessage: string
  hasExplicitSelection: boolean
  readOnlyActionReason?: string
  selectedArticle: ReaderArticle | undefined
  trackSelectedArticleRead: boolean
}) {
  if (!articles.length) {
    return (
      <Card className="min-h-96">
        <CardHeader>
          <CardTitle>No Articles</CardTitle>
          <CardDescription>{emptyMessage}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (displayMode === "READER" || defaultView === "RIVER") {
    return (
      <section className="flex flex-col gap-4">
        {articles.map((article) => (
          <ArticleReaderCard
            article={article}
            articleCollections={articleCollections}
            currentCollection={currentCollection}
            dateTimePreferences={dateTimePreferences}
            key={article.id}
            readOnlyActionReason={readOnlyActionReason}
          />
        ))}
      </section>
    )
  }

  if (defaultView === "CARD") {
    return (
      <section className="grid min-h-[70vh] min-w-0 gap-4 xl:grid-cols-[1fr_minmax(320px,440px)]">
        <div className={cn(hasExplicitSelection && "order-2 xl:order-1")}>
          <CardArticleGrid
            articles={articles}
            articleCollections={articleCollections}
            basePath={basePath}
            currentCollection={currentCollection}
            dateTimePreferences={dateTimePreferences}
            readOnlyActionReason={readOnlyActionReason}
            selectedArticleId={selectedArticle?.id}
          />
        </div>
        <ArticleReaderCard
          article={selectedArticle}
          articleCollections={articleCollections}
          className={cn(hasExplicitSelection && "order-1 xl:order-2")}
          currentCollection={currentCollection}
          dateTimePreferences={dateTimePreferences}
          readOnlyActionReason={readOnlyActionReason}
          trackRead={trackSelectedArticleRead}
        />
      </section>
    )
  }

  return (
    <section
      className={cn(
        "grid min-h-[70vh] min-w-0 gap-4 xl:grid-cols-[minmax(260px,380px)_1fr]",
        defaultView === "COMPACT" && "xl:grid-cols-[minmax(240px,340px)_1fr]"
      )}
    >
      <Card
        className={cn(
          "min-h-96 min-w-0",
          hasExplicitSelection && "order-2 xl:order-1"
        )}
      >
        <CardHeader>
          <CardTitle>Articles</CardTitle>
          <CardDescription>Newest stored items first</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {articles.map((article) => (
            <ArticleListItem
              article={article}
              articleCollections={articleCollections}
              basePath={basePath}
              compact={defaultView === "COMPACT"}
              currentCollection={currentCollection}
              dateTimePreferences={dateTimePreferences}
              key={article.id}
              readOnlyActionReason={readOnlyActionReason}
              selected={article.id === selectedArticle?.id}
            />
          ))}
        </CardContent>
      </Card>
      <ArticleReaderCard
        article={selectedArticle}
        articleCollections={articleCollections}
        className={cn(hasExplicitSelection && "order-1 xl:order-2")}
        currentCollection={currentCollection}
        dateTimePreferences={dateTimePreferences}
        readOnlyActionReason={readOnlyActionReason}
        trackRead={trackSelectedArticleRead}
      />
    </section>
  )
}

function ArticleListItem({
  article,
  articleCollections,
  basePath,
  compact,
  currentCollection,
  dateTimePreferences,
  readOnlyActionReason,
  selected,
}: {
  article: ReaderArticle
  articleCollections: ArticleCollectionPickerItem[]
  basePath: string
  compact: boolean
  currentCollection?: ActiveArticleCollection
  dateTimePreferences: DateTimePreferences
  readOnlyActionReason?: string
  selected: boolean
}) {
  return (
    <ArticleContextMenu
      article={articleContextMenuArticle(article)}
      collections={articleCollections}
      className={cn(
        "flex items-start gap-3 rounded-lg border bg-background p-3 transition-colors hover:bg-muted",
        selected && "bg-muted",
        compact && "p-2"
      )}
      currentCollection={currentCollection}
      inlineActions
      readOnlyReason={readOnlyActionReason}
    >
      <ArticleSourceIcon
        articleUrl={article.url}
        faviconUrl={article.feedFaviconUrl}
        title={article.feedTitle}
      />
      <Link
        className="min-w-0 flex-1 text-left"
        href={articleSelectionHref(basePath, article.id)}
      >
        <span
          className={cn(
            "block truncate text-sm",
            !article.isRead && "font-semibold"
          )}
        >
          {article.title}
        </span>
        <span className="mt-1 block truncate text-xs text-muted-foreground">
          {article.feedTitle}
          {article.publishedAt
            ? ` - ${formatArticleDateTime(
                article.publishedAt,
                dateTimePreferences
              )}`
            : ""}
        </span>
      </Link>
      {article.isStarred && (
        <StarIcon className="mt-0.5 size-3.5 fill-current text-primary" />
      )}
    </ArticleContextMenu>
  )
}

function CardArticleGrid({
  articles,
  articleCollections,
  basePath,
  currentCollection,
  dateTimePreferences,
  readOnlyActionReason,
  selectedArticleId,
}: {
  articles: ReaderArticle[]
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

function ArticleReaderCard({
  article,
  articleCollections,
  className,
  currentCollection,
  dateTimePreferences,
  readOnlyActionReason,
  trackRead = false,
}: {
  article: ReaderArticle | undefined
  articleCollections: ArticleCollectionPickerItem[]
  className?: string
  currentCollection?: ActiveArticleCollection
  dateTimePreferences: DateTimePreferences
  readOnlyActionReason?: string
  trackRead?: boolean
}) {
  if (!article) {
    return (
      <Card className={cn("min-h-96", className)}>
        <CardHeader>
          <CardTitle>Ready For Articles</CardTitle>
          <CardDescription>Subscribed articles will appear here.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const youtubeVideoId = extractYouTubeVideoId(article.url)

  return (
    <ArticleContextMenu
      article={articleContextMenuArticle(article)}
      className={cn("min-w-0", className)}
      collections={articleCollections}
      currentCollection={currentCollection}
      readOnlyReason={readOnlyActionReason}
    >
      <Card className="min-h-96 min-w-0">
        {trackRead && (
          <ArticleReadTracker articleId={article.id} isRead={article.isRead} />
        )}
        {youtubeVideoId ? (
          <YouTubeVideoEmbed title={article.title} videoId={youtubeVideoId} />
        ) : null}
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle>{article.title}</CardTitle>
              <CardDescription>
                {article.author ? `${article.author} - ` : ""}
                {article.feedTitle}
                {article.publishedAt
                  ? ` - ${formatArticleDateTime(
                      article.publishedAt,
                      dateTimePreferences
                    )}`
                  : ""}
              </CardDescription>
            </div>
            <ArticleActionToolbar
              article={articleContextMenuArticle(article)}
              collections={articleCollections}
              currentCollection={currentCollection}
              readOnlyReason={readOnlyActionReason}
              variant="persistent"
            />
          </div>
        </CardHeader>
        <CardContent className="flex min-w-0 flex-col gap-4 overflow-hidden text-sm leading-6 text-muted-foreground">
          <ArticleAiSummaryPanel
            articleId={article.id}
            readOnlyReason={readOnlyActionReason}
            summary={article.aiSummary}
          />
          <ArticleBody article={article} />
          <a
            className="inline-flex w-fit items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
            href={article.url}
            rel="noreferrer"
            target="_blank"
          >
            Open original
            <ExternalLinkIcon className="size-3.5" />
          </a>
          <Link
            className="inline-flex w-fit items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
            href={articleDetailHref(article.id)}
          >
            Permalink
            <LinkIcon className="size-3.5" />
          </Link>
        </CardContent>
      </Card>
    </ArticleContextMenu>
  )
}

function YouTubeVideoEmbed({
  title,
  videoId,
}: {
  title: string
  videoId: string
}) {
  return (
    <div className="border-b bg-black">
      <iframe
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="aspect-video w-full"
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        src={`https://www.youtube-nocookie.com/embed/${videoId}`}
        title={title}
      />
    </div>
  )
}

function articleContextMenuArticle(
  article: ReaderArticle
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

function ArticleBody({ article }: { article: ReaderArticle }) {
  const proxiedImageUrl = imageProxyUrl(article.imageUrl)
  const fallbackImageUrl =
    proxiedImageUrl &&
    !extractYouTubeVideoId(article.url) &&
    !articleHtmlHasImage(article.sanitizedContentHtml)
      ? proxiedImageUrl
      : null

  if (article.sanitizedContentHtml) {
    return (
      <>
        {fallbackImageUrl ? (
          <ArticleImageFallback imageUrl={fallbackImageUrl} />
        ) : null}
        <div
          className="min-w-0 max-w-full space-y-4 break-words text-foreground [&_*]:max-w-full [&_a]:break-words [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l [&_blockquote]:pl-4 [&_img]:max-h-[520px] [&_img]:rounded-lg [&_img]:object-contain [&_p]:break-words [&_pre]:overflow-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3"
          dangerouslySetInnerHTML={{ __html: article.sanitizedContentHtml }}
        />
      </>
    )
  }

  return (
    <>
      {fallbackImageUrl ? (
        <ArticleImageFallback imageUrl={fallbackImageUrl} />
      ) : null}
      <p className="min-w-0 whitespace-pre-wrap break-words">
        {article.contentText ||
          "This article did not include readable body text in the feed."}
      </p>
    </>
  )
}

function ArticleImageFallback({ imageUrl }: { imageUrl: string }) {
  // Feed-level images are body media here, not cropped preview headers.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt=""
      className="max-h-[520px] w-full rounded-lg object-contain"
      src={imageUrl}
    />
  )
}

function articleHtmlHasImage(html: string | null) {
  return Boolean(html && ARTICLE_IMAGE_HTML_PATTERN.test(html))
}

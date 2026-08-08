import Link from "next/link"
import { ExternalLinkIcon, LinkIcon, StarIcon } from "lucide-react"

import { ArticleAiSummaryPanel } from "@/components/article-ai-summary-panel"
import {
  ArticleActionToolbar,
  ArticleContextMenu,
  type ActiveArticleCollection,
} from "@/components/article-context-menu"
import { ArticleSourceIcon } from "@/components/article-source-icon"
import { ArticleReadTracker } from "@/components/article-read-tracker"
import { StoryClusterDismissButton } from "@/components/story-cluster-dismiss-button"
import { StoryClusterPanel } from "@/components/story-cluster-panel"
import { StoryClusterSplitButton } from "@/components/story-cluster-split-button"
import { MarkAllReadButton } from "@/components/article-state-controls"
import { ReaderKeyboardShortcuts } from "@/components/reader-keyboard-shortcuts"
import { ReaderViewSwitcher } from "@/components/reader-view-switcher"
import { ArticleBody } from "@/components/reader/article-body"
import {
  ArticleCardGrid,
  articleContextMenuArticle,
} from "@/components/reader/article-card-grid"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  type ArticleReadScope,
  type ReaderArticle,
  type ReaderArticleListItem,
} from "@/lib/articles"
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
import { type StoryClusterPresentation } from "@/lib/story-cluster-reader"
import { extractYouTubeVideoId } from "@/lib/youtube-feeds"
import { cn } from "@/lib/utils"

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
  inlineStoryClusters,
  readOnlyActionReason,
  riverArticles,
  selectedArticle: selectedArticleDetail,
  selectedArticleId,
  storyClusters,
  title,
  toolbar,
}: {
  articles: ReaderArticleListItem[]
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
  inlineStoryClusters?: StoryClusterPresentation[]
  readOnlyActionReason?: string
  riverArticles?: ReaderArticle[]
  selectedArticle?: ReaderArticle
  selectedArticleId?: string
  storyClusters?: StoryClusterPresentation[]
  title: string
  toolbar?: React.ReactNode
}) {
  const explicitlySelectedArticle = selectedArticleId
    ? articles.find((article) => article.id === selectedArticleId)
    : undefined
  const selectedListArticle = explicitlySelectedArticle ?? articles[0]
  const selectedArticle =
    selectedArticleDetail ??
    (isReaderArticle(selectedListArticle) ? selectedListArticle : undefined)
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
        inlineStoryClusters,
        readOnlyActionReason,
        riverArticles,
        selectedArticle,
        storyClusters,
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
  inlineStoryClusters,
  readOnlyActionReason,
  riverArticles,
  selectedArticle,
  storyClusters,
  trackSelectedArticleRead,
}: {
  articleCollections: ArticleCollectionPickerItem[]
  articles: ReaderArticleListItem[]
  basePath: string
  currentCollection?: ActiveArticleCollection
  dateTimePreferences: DateTimePreferences
  defaultView: DefaultView
  displayMode: DisplayMode
  emptyMessage: string
  hasExplicitSelection: boolean
  inlineStoryClusters?: StoryClusterPresentation[]
  readOnlyActionReason?: string
  riverArticles?: ReaderArticle[]
  selectedArticle: ReaderArticle | undefined
  storyClusters?: StoryClusterPresentation[]
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
    const visibleRiverArticles =
      riverArticles?.length
        ? riverArticles
        : articles.filter(isReaderArticle)

    return (
      <section className="flex flex-col gap-4">
        {visibleRiverArticles.map((article) => (
          <ArticleReaderCard
            article={article}
            articleCollections={articleCollections}
            currentCollection={currentCollection}
            dateTimePreferences={dateTimePreferences}
            key={article.id}
            readOnlyActionReason={readOnlyActionReason}
            storyClusters={
              article.id === selectedArticle?.id ? storyClusters : undefined
            }
          />
        ))}
      </section>
    )
  }

  const articleListRows = storyClusterListRows(articles, inlineStoryClusters)

  if (defaultView === "CARD") {
    return (
      <section className="grid min-h-[70vh] min-w-0 gap-4 xl:grid-cols-[1fr_minmax(320px,440px)]">
        <div className={cn(hasExplicitSelection && "order-2 xl:order-1")}>
          <ArticleCardGrid
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
          storyClusters={storyClusters}
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
          {articleListRows.map((row) =>
            row.cluster ? (
              <InlineStoryClusterListItem
                article={row.article}
                articleCollections={articleCollections}
                basePath={basePath}
                cluster={row.cluster}
                compact={defaultView === "COMPACT"}
                currentCollection={currentCollection}
                dateTimePreferences={dateTimePreferences}
                key={row.article.id}
                readOnlyActionReason={readOnlyActionReason}
                selected={row.article.id === selectedArticle?.id}
              />
            ) : (
              <ArticleListItem
                article={row.article}
                articleCollections={articleCollections}
                basePath={basePath}
                compact={defaultView === "COMPACT"}
                currentCollection={currentCollection}
                dateTimePreferences={dateTimePreferences}
                key={row.article.id}
                readOnlyActionReason={readOnlyActionReason}
                selected={row.article.id === selectedArticle?.id}
              />
            )
          )}
        </CardContent>
      </Card>
      <ArticleReaderCard
        article={selectedArticle}
        articleCollections={articleCollections}
        className={cn(hasExplicitSelection && "order-1 xl:order-2")}
        currentCollection={currentCollection}
        dateTimePreferences={dateTimePreferences}
        readOnlyActionReason={readOnlyActionReason}
        storyClusters={storyClusters}
        trackRead={trackSelectedArticleRead}
      />
    </section>
  )
}

function ArticleListItem({
  article,
  articleCollections,
  basePath,
  className,
  compact,
  currentCollection,
  dateTimePreferences,
  readOnlyActionReason,
  selected,
}: {
  article: ReaderArticleListItem
  articleCollections: ArticleCollectionPickerItem[]
  basePath: string
  className?: string
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
        className,
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

function InlineStoryClusterListItem({
  article,
  articleCollections,
  basePath,
  cluster,
  compact,
  currentCollection,
  dateTimePreferences,
  readOnlyActionReason,
  selected,
}: {
  article: ReaderArticleListItem
  articleCollections: ArticleCollectionPickerItem[]
  basePath: string
  cluster: StoryClusterPresentation
  compact: boolean
  currentCollection?: ActiveArticleCollection
  dateTimePreferences: DateTimePreferences
  readOnlyActionReason?: string
  selected: boolean
}) {
  const sources = cluster.members
    .slice()
    .sort((left, right) => {
      const leftTime = left.publishedAt ? new Date(left.publishedAt).getTime() : 0
      const rightTime = right.publishedAt ? new Date(right.publishedAt).getTime() : 0

      return rightTime - leftTime || left.title.localeCompare(right.title)
    })
  const sourceCount = sources.length

  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <ArticleListItem
        article={article}
        articleCollections={articleCollections}
        basePath={basePath}
        className="rounded-none border-0"
        compact={compact}
        currentCollection={currentCollection}
        dateTimePreferences={dateTimePreferences}
        readOnlyActionReason={readOnlyActionReason}
        selected={selected}
      />
      <details className="group border-t bg-muted/20">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs text-muted-foreground outline-none transition-colors hover:bg-muted/45 focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
          <span className="font-medium text-foreground">
            {sourceCount} {sourceCount === 1 ? "source" : "sources"} reporting this story
          </span>
          <span className="group-open:hidden">Show sources</span>
          <span className="hidden group-open:inline">Hide sources</span>
        </summary>
        <div className="flex flex-col gap-3 border-t px-3 py-3 text-sm">
          <p className="text-xs leading-5 text-muted-foreground">
            Grouped because: {cluster.reasons.map(storyClusterReasonLabel).join("; ")}. Every source remains available.
          </p>
          <ul className="flex flex-col gap-2">
            {sources.map((source) => (
              <li className="rounded-md border bg-background p-2" key={source.articleId}>
                <Link
                  className="block font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  href={articleSelectionHref(basePath, source.articleId)}
                >
                  {source.title}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  {source.feedTitle}
                  {source.publishedAt
                    ? ` - ${formatArticleDateTime(
                        new Date(source.publishedAt),
                        dateTimePreferences
                      )}`
                    : ""}
                </p>
                {sourceCount > 2 ? (
                  <StoryClusterSplitButton
                    articleId={article.id}
                    clusterId={cluster.id}
                    memberArticleId={source.articleId}
                  />
                ) : null}
              </li>
            ))}
          </ul>
          <p className="text-xs leading-5 text-muted-foreground">
            {sourceCount > 2
              ? "Separate a source when it does not belong in this story."
              : "Dismiss this grouping if these sources should stay separate."}
          </p>
          <StoryClusterDismissButton articleId={article.id} clusterId={cluster.id} />
        </div>
      </details>
    </div>
  )
}

type StoryClusterListRow = {
  article: ReaderArticleListItem
  cluster?: StoryClusterPresentation
}

function storyClusterListRows(
  articles: ReaderArticleListItem[],
  clusters: StoryClusterPresentation[] | undefined
): StoryClusterListRow[] {
  if (!clusters?.length) {
    return articles.map((article) => ({ article }))
  }

  const articlePosition = new Map(
    articles.map((article, index) => [article.id, index])
  )
  const candidates = clusters
    .map((cluster) => ({
      cluster,
      articles: articles.filter((article) =>
        cluster.members.some((member) => member.articleId === article.id)
      ),
    }))
    .filter((candidate) => candidate.articles.length > 1)
    .sort((left, right) => {
      const leftPosition = articlePosition.get(left.articles[0]?.id ?? "") ?? 0
      const rightPosition = articlePosition.get(right.articles[0]?.id ?? "") ?? 0

      return leftPosition - rightPosition || right.articles.length - left.articles.length
    })
  const hiddenArticleIds = new Set<string>()
  const clusterByPrimaryArticleId = new Map<string, StoryClusterPresentation>()

  for (const candidate of candidates) {
    const availableArticles = candidate.articles.filter(
      (article) => !hiddenArticleIds.has(article.id)
    )

    if (availableArticles.length < 2) {
      continue
    }

    const primaryArticle = availableArticles[0]
    clusterByPrimaryArticleId.set(primaryArticle.id, candidate.cluster)
    availableArticles.forEach((article) => hiddenArticleIds.add(article.id))
  }

  return articles.flatMap((article) => {
    const cluster = clusterByPrimaryArticleId.get(article.id)

    if (cluster) {
      return [{ article, cluster }]
    }

    return hiddenArticleIds.has(article.id) ? [] : [{ article }]
  })
}

function storyClusterReasonLabel(
  reason: StoryClusterPresentation["reasons"][number]
) {
  const labels = {
    CANONICAL_URL: "the same original link",
    NORMALIZED_TITLE: "matching headlines",
    PUBLICATION_TIME_WINDOW: "publication within 72 hours",
    SHARED_NAMED_ENTITIES: "shared named people, places, or organizations",
    SOURCE_DUPLICATION: "the same source coverage",
    TEXT_SIMILARITY: "similar article text",
  } satisfies Record<StoryClusterPresentation["reasons"][number], string>

  return labels[reason]
}

function ArticleReaderCard({
  article,
  articleCollections,
  className,
  currentCollection,
  dateTimePreferences,
  readOnlyActionReason,
  storyClusters,
  trackRead = false,
}: {
  article: ReaderArticle | undefined
  articleCollections: ArticleCollectionPickerItem[]
  className?: string
  currentCollection?: ActiveArticleCollection
  dateTimePreferences: DateTimePreferences
  readOnlyActionReason?: string
  storyClusters?: StoryClusterPresentation[]
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
          {storyClusters ? (
            <StoryClusterPanel articleId={article.id} clusters={storyClusters} />
          ) : null}
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

function isReaderArticle(
  article: ReaderArticleListItem | undefined
): article is ReaderArticle {
  return Boolean(article && "sanitizedContentHtml" in article)
}

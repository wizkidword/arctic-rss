import Link from "next/link"
import { ExternalLinkIcon, LinkIcon, StarIcon } from "lucide-react"

import { ArticleAiSummaryPanel } from "@/components/article-ai-summary-panel"
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
import { type DefaultView } from "@/lib/preferences"
import {
  articleDetailHref,
  articleSelectionHref,
} from "@/lib/reader-navigation"
import { cn } from "@/lib/utils"

const articleDateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
})

export function ReaderSurface({
  articles,
  basePath,
  defaultView,
  description,
  emptyMessage,
  markAllReadScope,
  selectedArticleId,
  title,
  toolbar,
}: {
  articles: ReaderArticle[]
  basePath: string
  defaultView: DefaultView
  description: string
  emptyMessage: string
  markAllReadScope?: ArticleReadScope
  selectedArticleId?: string
  title: string
  toolbar?: React.ReactNode
}) {
  const explicitlySelectedArticle = selectedArticleId
    ? articles.find((article) => article.id === selectedArticleId)
    : undefined
  const selectedArticle = explicitlySelectedArticle ?? articles[0]
  const keyboardArticles = articles.map((article) => ({
    id: article.id,
    isRead: article.isRead,
    isStarred: article.isStarred,
    url: article.url,
  }))
  const headerToolbar = (
    <div className="flex flex-col gap-2 sm:items-end">
      <ReaderViewSwitcher defaultView={defaultView} />
      <div className="flex flex-wrap gap-2 sm:justify-end">
        {markAllReadScope && (
          <MarkAllReadButton
            disabled={!articles.length}
            scope={markAllReadScope}
          />
        )}
        {toolbar}
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen flex-col gap-4 p-3 sm:p-4 lg:p-6">
      <ReaderKeyboardShortcuts
        articles={keyboardArticles}
        basePath={basePath}
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
        articles,
        basePath,
        defaultView,
        emptyMessage,
        selectedArticle,
        trackSelectedArticleRead: Boolean(explicitlySelectedArticle),
      })}
    </div>
  )
}

function renderReaderView({
  articles,
  basePath,
  defaultView,
  emptyMessage,
  selectedArticle,
  trackSelectedArticleRead,
}: {
  articles: ReaderArticle[]
  basePath: string
  defaultView: DefaultView
  emptyMessage: string
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

  if (defaultView === "CARD") {
    return (
      <section className="grid min-h-[70vh] gap-4 xl:grid-cols-[1fr_minmax(320px,440px)]">
        <CardArticleGrid
          articles={articles}
          basePath={basePath}
          selectedArticleId={selectedArticle?.id}
        />
        <ArticleReaderCard
          article={selectedArticle}
          trackRead={trackSelectedArticleRead}
        />
      </section>
    )
  }

  if (defaultView === "RIVER") {
    return (
      <section className="flex flex-col gap-4">
        {articles.map((article) => (
          <ArticleReaderCard article={article} key={article.id} />
        ))}
      </section>
    )
  }

  return (
    <section
      className={cn(
        "grid min-h-[70vh] gap-4 xl:grid-cols-[minmax(260px,380px)_1fr]",
        defaultView === "COMPACT" && "xl:grid-cols-[minmax(240px,340px)_1fr]"
      )}
    >
      <Card className="min-h-96">
        <CardHeader>
          <CardTitle>Articles</CardTitle>
          <CardDescription>Newest stored items first</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {articles.map((article) => (
            <ArticleListItem
              article={article}
              basePath={basePath}
              compact={defaultView === "COMPACT"}
              key={article.id}
              selected={article.id === selectedArticle?.id}
            />
          ))}
        </CardContent>
      </Card>
      <ArticleReaderCard
        article={selectedArticle}
        trackRead={trackSelectedArticleRead}
      />
    </section>
  )
}

function ArticleListItem({
  article,
  basePath,
  compact,
  selected,
}: {
  article: ReaderArticle
  basePath: string
  compact: boolean
  selected: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border bg-background p-3 transition-colors hover:bg-muted",
        selected && "bg-muted",
        compact && "p-2"
      )}
    >
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
            ? ` - ${articleDateFormatter.format(article.publishedAt)}`
            : ""}
        </span>
      </Link>
      {article.isStarred && (
        <StarIcon className="mt-0.5 size-3.5 fill-current text-primary" />
      )}
    </div>
  )
}

function CardArticleGrid({
  articles,
  basePath,
  selectedArticleId,
}: {
  articles: ReaderArticle[]
  basePath: string
  selectedArticleId?: string
}) {
  return (
    <div className="grid content-start gap-3 sm:grid-cols-2">
      {articles.map((article) => (
        <article
          className={cn(
            "overflow-hidden rounded-lg border bg-card transition-colors hover:bg-muted",
            article.id === selectedArticleId && "bg-muted"
          )}
          key={article.id}
        >
          {article.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt=""
              className="aspect-video w-full object-cover"
              src={article.imageUrl}
            />
          )}
          <div className="flex flex-col gap-3 p-3">
            <Link href={articleSelectionHref(basePath, article.id)}>
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
                  ? ` - ${articleDateFormatter.format(article.publishedAt)}`
                  : ""}
              </p>
            </Link>
            {article.summary && (
              <p className="line-clamp-3 text-xs leading-5 text-muted-foreground">
                {article.summary}
              </p>
            )}
            <ArticleStateControls article={article} size="xs" />
          </div>
        </article>
      ))}
    </div>
  )
}

function ArticleReaderCard({
  article,
  trackRead = false,
}: {
  article: ReaderArticle | undefined
  trackRead?: boolean
}) {
  if (!article) {
    return (
      <Card className="min-h-96">
        <CardHeader>
          <CardTitle>Ready For Articles</CardTitle>
          <CardDescription>Subscribed articles will appear here.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="min-h-96">
      {trackRead && (
        <ArticleReadTracker articleId={article.id} isRead={article.isRead} />
      )}
      {article.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" className="h-56 w-full object-cover" src={article.imageUrl} />
      )}
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle>{article.title}</CardTitle>
            <CardDescription>
              {article.author ? `${article.author} - ` : ""}
              {article.feedTitle}
              {article.publishedAt
                ? ` - ${articleDateFormatter.format(article.publishedAt)}`
                : ""}
            </CardDescription>
          </div>
          <ArticleStateControls article={article} />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm leading-6 text-muted-foreground">
        {article.summary && (
          <p className="font-medium text-foreground">{article.summary}</p>
        )}
        <ArticleAiSummaryPanel
          articleId={article.id}
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
  )
}

function ArticleBody({ article }: { article: ReaderArticle }) {
  if (article.sanitizedContentHtml) {
    return (
      <div
        className="space-y-4 text-foreground [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l [&_blockquote]:pl-4 [&_img]:max-h-[520px] [&_img]:rounded-lg [&_img]:object-contain [&_pre]:overflow-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3"
        dangerouslySetInnerHTML={{ __html: article.sanitizedContentHtml }}
      />
    )
  }

  return (
    <p className="whitespace-pre-wrap">
      {article.contentText ||
        "This article did not include readable body text in the feed."}
    </p>
  )
}

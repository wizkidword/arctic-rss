import { SearchIcon } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { ReaderSurface } from "@/components/reader-surface"
import { listArticleCollectionsForUser } from "@/lib/article-collections"
import {
  loadReaderArticleView,
  readerArticlePageLimit,
} from "@/lib/articles"
import {
  articleSearchHref,
  ARTICLE_SEARCH_QUERY_VERSION,
  listReaderArticleSearchPage,
  parseArticleSearchFilters,
  savedSearchCreateHref,
  type ArticleSearchFilters,
  type ArticleSearchParams,
} from "@/lib/article-search"
import { listUserFeedSubscriptions } from "@/lib/feed-subscriptions"
import { listUserFolders } from "@/lib/folders"
import { normalizeDefaultView } from "@/lib/preferences"
import { normalizeDateTimePreferences, normalizeDisplayMode } from "@/lib/settings"
import { getOrCreateUserSettings } from "@/lib/user-settings"

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<ArticleSearchParams>
}) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const params = await searchParams
  const filters = parseArticleSearchFilters(params)
  const [settings, articleCollections, subscriptions, folders] =
    await Promise.all([
      getOrCreateUserSettings(session.user.id),
      listArticleCollectionsForUser(session.user.id),
      listUserFeedSubscriptions(session.user.id),
      listUserFolders(session.user.id),
    ])
  const basePath = articleSearchHref(filters, { after: filters.after })
  const defaultView = normalizeDefaultView(settings.defaultView)
  const displayMode = normalizeDisplayMode(settings.displayMode)
  const articlePage = await listReaderArticleSearchPage({
    filters,
    limit: readerArticlePageLimit({ defaultView, displayMode }),
    userId: session.user.id,
  })
  const articleId = firstSearchParam(params.articleId)
  const readerView = await loadReaderArticleView({
    articleIds: articlePage.articles.map((article) => article.id),
    defaultView,
    displayMode,
    selectedArticleId: articleId,
    userId: session.user.id,
  })

  return (
    <ReaderSurface
      articles={articlePage.articles}
      articleCollections={articleCollections}
      basePath={basePath}
      dateTimePreferences={normalizeDateTimePreferences(settings)}
      defaultView={defaultView}
      displayMode={displayMode}
      description="Search the articles available to you by topic, source, folder, date, or reading state."
      emptyMessage={
        filters.query
          ? "No available articles matched this search. Try a different phrase or broaden the filters."
          : "Enter a phrase to search the articles in your active feed subscriptions."
      }
      nextPageHref={
        articlePage.nextCursor
          ? articleSearchHref(filters, { after: articlePage.nextCursor })
          : undefined
      }
      riverArticles={readerView.riverArticles}
      selectedArticle={readerView.selectedArticle ?? undefined}
      selectedArticleId={articleId}
      title="Search"
      toolbar={
        <ArticleSearchForm
          articleCollections={articleCollections}
          filters={filters}
          folders={folders}
          subscriptions={subscriptions
            .filter((subscription) => !subscription.isPaused)
            .map((subscription) => ({
              id: subscription.id,
              name: subscription.title,
            }))}
        />
      }
    />
  )
}

function ArticleSearchForm({
  articleCollections,
  filters,
  folders,
  subscriptions,
}: {
  articleCollections: Array<{ id: string; name: string }>
  filters: ArticleSearchFilters
  folders: Array<{ id: string; name: string }>
  subscriptions: Array<{ id: string; name: string }>
}) {
  return (
    <form action="/app/search" className="grid w-full gap-2 sm:min-w-[38rem]">
      <input
        name="v"
        type="hidden"
        value={String(ARTICLE_SEARCH_QUERY_VERSION)}
      />
      <label className="sr-only" htmlFor="article-search-query">
        Search articles
      </label>
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-52 flex-1">
          <SearchIcon
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            className="h-9 w-full rounded-md border bg-background px-9 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            defaultValue={filters.query}
            id="article-search-query"
            maxLength={200}
            name="q"
            placeholder="Search articles"
            type="search"
          />
        </div>
        <button
          className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          type="submit"
        >
          Search
        </button>
        {filters.query && (
          <Link
            className="inline-flex h-9 items-center rounded-md border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
            href={savedSearchCreateHref(filters)}
          >
            Save search
          </Link>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <SearchSelect
          defaultValue={filters.subscriptionId}
          label="Source"
          name="source"
          options={subscriptions}
        />
        <SearchSelect
          defaultValue={filters.folderId}
          label="Folder"
          name="folder"
          options={folders}
        />
        <SearchSelect
          defaultValue={filters.collectionId}
          label="Collection"
          name="collection"
          options={articleCollections}
        />
        <label className="grid gap-1 text-xs text-muted-foreground">
          State
          <select
            className="h-8 rounded-md border bg-background px-2 text-sm text-foreground"
            defaultValue={filters.state}
            name="state"
          >
            <option value="all">Any state</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
            <option value="starred">Starred</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-xs text-muted-foreground">
            From
            <input
              className="h-8 rounded-md border bg-background px-2 text-sm text-foreground"
              defaultValue={
                filters.publishedAfter
                  ? calendarDateValue(filters.publishedAfter)
                  : undefined
              }
              name="from"
              type="date"
            />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            To
            <input
              className="h-8 rounded-md border bg-background px-2 text-sm text-foreground"
              defaultValue={
                filters.publishedBefore
                  ? calendarDateValue(
                      new Date(
                        filters.publishedBefore.getTime() -
                          24 * 60 * 60 * 1000
                      )
                    )
                  : undefined
              }
              name="to"
              type="date"
            />
          </label>
        </div>
      </div>
    </form>
  )
}

function SearchSelect({
  defaultValue,
  label,
  name,
  options,
}: {
  defaultValue?: string
  label: string
  name: string
  options: Array<{ id: string; name: string }>
}) {
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      {label}
      <select
        className="h-8 rounded-md border bg-background px-2 text-sm text-foreground"
        defaultValue={defaultValue ?? ""}
        name={name}
      >
        <option value="">Any {label.toLowerCase()}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  )
}

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function calendarDateValue(value: Date) {
  return value.toISOString().slice(0, 10)
}

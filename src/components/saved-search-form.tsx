"use client"

import { useActionState } from "react"
import { LoaderCircleIcon, SaveIcon } from "lucide-react"

import {
  createSavedSearchAction,
  type SavedSearchActionState,
} from "@/app/app/saved-searches/actions"
import { Button } from "@/components/ui/button"
import {
  ARTICLE_SEARCH_QUERY_VERSION,
  type ArticleSearchFilters,
} from "@/lib/article-search-types"

const initialState: SavedSearchActionState = {
  message: "",
  status: "idle",
}

export function SavedSearchForm({ filters }: { filters: ArticleSearchFilters }) {
  const [state, formAction, pending] = useActionState(
    createSavedSearchAction,
    initialState
  )

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-lg border bg-card p-4"
    >
      <SearchFilterFields filters={filters} />
      <label className="grid gap-2">
        <span className="text-sm font-medium">Saved search name</span>
        <input
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          maxLength={80}
          name="name"
          required
          type="text"
        />
      </label>
      <label className="grid gap-2">
        <span className="text-sm font-medium">Description <span className="text-muted-foreground">(optional)</span></span>
        <textarea
          className="min-h-20 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          maxLength={500}
          name="description"
        />
      </label>
      <div className="rounded-lg border bg-muted/30 p-3 text-sm">
        <p className="font-medium">Search definition</p>
        <p className="mt-1 text-muted-foreground">{searchDescription(filters)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={pending} type="submit">
          {pending ? (
            <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />
          ) : (
            <SaveIcon data-icon="inline-start" />
          )}
          {pending ? "Saving" : "Save search"}
        </Button>
        {state.message && (
          <p
            aria-live="polite"
            className={
              state.status === "error"
                ? "text-sm text-destructive"
                : "text-sm text-muted-foreground"
            }
          >
            {state.message}
          </p>
        )}
      </div>
    </form>
  )
}

function SearchFilterFields({ filters }: { filters: ArticleSearchFilters }) {
  return (
    <>
      <input name="v" type="hidden" value={String(ARTICLE_SEARCH_QUERY_VERSION)} />
      <input name="q" type="hidden" value={filters.query} />
      <input name="state" type="hidden" value={filters.state} />
      {filters.subscriptionId && (
        <input name="source" type="hidden" value={filters.subscriptionId} />
      )}
      {filters.folderId && (
        <input name="folder" type="hidden" value={filters.folderId} />
      )}
      {filters.collectionId && (
        <input name="collection" type="hidden" value={filters.collectionId} />
      )}
      {filters.publishedAfter && (
        <input name="from" type="hidden" value={calendarDateValue(filters.publishedAfter)} />
      )}
      {filters.publishedBefore && (
        <input
          name="to"
          type="hidden"
          value={calendarDateValue(
            new Date(filters.publishedBefore.getTime() - 24 * 60 * 60 * 1000)
          )}
        />
      )}
    </>
  )
}

function searchDescription(filters: ArticleSearchFilters) {
  const scopes = [
    filters.subscriptionId ? "one source" : null,
    filters.folderId ? "one folder" : null,
    filters.collectionId ? "one collection" : null,
    filters.state !== "all" ? `${filters.state} articles` : null,
    filters.publishedAfter || filters.publishedBefore ? "a date range" : null,
  ].filter(Boolean)

  return `“${filters.query}”${scopes.length ? ` in ${scopes.join(", ")}` : " across your active sources"}.`
}

function calendarDateValue(value: Date) {
  return value.toISOString().slice(0, 10)
}

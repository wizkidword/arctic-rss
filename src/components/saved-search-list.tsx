import Link from "next/link"
import { BellRingIcon, BookmarkIcon, CheckIcon, PauseIcon, PlayIcon, Trash2Icon } from "lucide-react"

import {
  acknowledgeSavedSearchMonitorAction,
  deleteSavedSearchAction,
  setSavedSearchMonitorEnabledAction,
} from "@/app/app/saved-searches/actions"
import { Button, buttonVariants } from "@/components/ui/button"
import { savedSearchHref, type SavedSearchRecord } from "@/lib/saved-searches"
import { cn } from "@/lib/utils"

export function SavedSearchList({
  savedSearches,
}: {
  savedSearches: SavedSearchRecord[]
}) {
  if (!savedSearches.length) {
    return (
      <section className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2">
          <BookmarkIcon className="size-4 text-muted-foreground" />
          <h2 className="font-heading text-base font-medium">No saved searches yet</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Run a search, then save its filters here for quick reuse.
        </p>
        <Link className={cn(buttonVariants({ variant: "outline" }), "mt-4")} href="/app/search">
          Open search
        </Link>
      </section>
    )
  }

  return (
    <section className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b p-4">
        <BookmarkIcon className="size-4 text-muted-foreground" />
        <h2 className="font-heading text-base font-medium">Saved searches</h2>
      </div>
      <div className="divide-y">
        {savedSearches.map((savedSearch) => (
          <article
            className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto]"
            key={savedSearch.id}
          >
            <div className="min-w-0">
              <Link
                className="font-medium underline-offset-4 hover:underline"
                href={savedSearchHref(savedSearch)}
              >
                {savedSearch.name}
              </Link>
              {savedSearch.description && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {savedSearch.description}
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                {savedSearch.query}
              </p>
              {savedSearch.monitorEnabled && (
                <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                  <BellRingIcon aria-hidden="true" className="size-3" />
                  Monitoring new incoming coverage
                  {savedSearch.monitorNewMatchCount > 0 && (
                    <span className="font-medium text-foreground">
                      · {savedSearch.monitorNewMatchCount} new
                    </span>
                  )}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 self-start">
              <form action={setSavedSearchMonitorEnabledAction}>
                <input name="enabled" type="hidden" value={String(!savedSearch.monitorEnabled)} />
                <input name="savedSearchId" type="hidden" value={savedSearch.id} />
                <Button size="sm" type="submit" variant="ghost">
                  {savedSearch.monitorEnabled ? (
                    <PauseIcon data-icon="inline-start" />
                  ) : (
                    <PlayIcon data-icon="inline-start" />
                  )}
                  {savedSearch.monitorEnabled ? "Pause monitor" : "Monitor"}
                </Button>
              </form>
              {savedSearch.monitorEnabled && savedSearch.monitorNewMatchCount > 0 && (
                <form action={acknowledgeSavedSearchMonitorAction}>
                  <input name="savedSearchId" type="hidden" value={savedSearch.id} />
                  <Button size="sm" type="submit" variant="ghost">
                    <CheckIcon data-icon="inline-start" />
                    Mark seen
                  </Button>
                </form>
              )}
              <form action={deleteSavedSearchAction}>
                <input name="savedSearchId" type="hidden" value={savedSearch.id} />
                <Button size="sm" type="submit" variant="ghost">
                  <Trash2Icon data-icon="inline-start" />
                  Delete
                </Button>
              </form>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

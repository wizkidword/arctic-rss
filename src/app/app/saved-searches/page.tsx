import Link from "next/link"
import { BookmarkIcon, SearchIcon } from "lucide-react"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { BriefingsWorkflowGuide } from "@/components/briefings-workflow-guide"
import { SavedSearchList } from "@/components/saved-search-list"
import { buttonVariants } from "@/components/ui/button"
import { listSavedSearchesForUser } from "@/lib/saved-searches"
import { cn } from "@/lib/utils"

export default async function SavedSearchesPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const savedSearches = await listSavedSearchesForUser(session.user.id)

  return (
    <div className="flex min-h-screen flex-col gap-4 p-3 sm:p-4 lg:p-6">
      <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BookmarkIcon className="size-4 text-muted-foreground" />
            <h1 className="font-heading text-xl font-semibold">Saved searches</h1>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Keep private shortcuts to searches across the sources you follow.
          </p>
        </div>
        <Link className={cn(buttonVariants(), "w-fit gap-2")} href="/app/search">
          <SearchIcon data-icon="inline-start" />
          Open search
        </Link>
      </section>
      <BriefingsWorkflowGuide />
      <SavedSearchList savedSearches={savedSearches} />
    </div>
  )
}

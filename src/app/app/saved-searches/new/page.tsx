import Link from "next/link"
import { ArrowLeftIcon, BookmarkIcon } from "lucide-react"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { SavedSearchForm } from "@/components/saved-search-form"
import { buttonVariants } from "@/components/ui/button"
import {
  parseArticleSearchFilters,
  type ArticleSearchParams,
} from "@/lib/article-search"
import { cn } from "@/lib/utils"

export default async function NewSavedSearchPage({
  searchParams,
}: {
  searchParams: Promise<ArticleSearchParams>
}) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const filters = parseArticleSearchFilters(await searchParams)

  return (
    <div className="flex min-h-screen flex-col gap-4 p-3 sm:p-4 lg:p-6">
      <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BookmarkIcon className="size-4 text-muted-foreground" />
            <h1 className="font-heading text-xl font-semibold">Save search</h1>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Save this filter set as a private shortcut. It will not send alerts or run in the background.
          </p>
        </div>
        <Link
          className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
          href="/app/saved-searches"
        >
          <ArrowLeftIcon data-icon="inline-start" />
          Saved searches
        </Link>
      </section>
      <SavedSearchForm filters={filters} />
    </div>
  )
}

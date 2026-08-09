import Link from "next/link"
import {
  BellRingIcon,
  BookmarkIcon,
  ListChecksIcon,
  SearchIcon,
  SparklesIcon,
} from "lucide-react"

export function BriefingsWorkflowGuide() {
  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="font-heading text-base font-medium">
        From search to briefing
      </h2>
      <ol className="mt-3 grid gap-3 text-sm leading-6 text-muted-foreground lg:grid-cols-5">
        <li>
          <Link
            className="flex items-center gap-2 font-medium text-foreground underline-offset-4 hover:underline"
            href="/app/search"
          >
            <SearchIcon className="size-4" />
            Search
          </Link>
          <p className="mt-1">Find articles by topic, source, folder, date, or reading state.</p>
        </li>
        <li>
          <Link
            className="flex items-center gap-2 font-medium text-foreground underline-offset-4 hover:underline"
            href="/app/saved-searches"
          >
            <BookmarkIcon className="size-4" />
            Save view
          </Link>
          <p className="mt-1">Keep the filters you want to return to as a private saved view.</p>
        </li>
        <li>
          <Link
            className="flex items-center gap-2 font-medium text-foreground underline-offset-4 hover:underline"
            href="/app/saved-searches"
          >
            <BellRingIcon className="size-4" />
            Monitor
          </Link>
          <p className="mt-1">Preview the saved view, then count or star new matches. You can pause it anytime.</p>
        </li>
        <li>
          <Link
            className="flex items-center gap-2 font-medium text-foreground underline-offset-4 hover:underline"
            href="/app/smart-digests"
          >
            <SparklesIcon className="size-4" />
            Smart Digest
          </Link>
          <p className="mt-1">Create a scheduled briefing from the topic and sources you choose.</p>
        </li>
        <li>
          <Link
            className="flex items-center gap-2 font-medium text-foreground underline-offset-4 hover:underline"
            href="/app/smart-digests"
          >
            <ListChecksIcon className="size-4" />
            Review results
          </Link>
          <p className="mt-1">Open the latest briefing to review each matching article and source.</p>
        </li>
      </ol>
    </section>
  )
}

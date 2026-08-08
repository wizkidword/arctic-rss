import { BellRingIcon, BookmarkIcon, SparklesIcon } from "lucide-react"

export function BriefingsWorkflowGuide() {
  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="font-heading text-base font-medium">
        From search to briefing
      </h2>
      <ol className="mt-3 grid gap-3 text-sm leading-6 text-muted-foreground md:grid-cols-3">
        <li>
          <div className="flex items-center gap-2 font-medium text-foreground">
            <BookmarkIcon className="size-4" />
            Saved view
          </div>
          <p className="mt-1">A private shortcut to the search filters you use again.</p>
        </li>
        <li>
          <div className="flex items-center gap-2 font-medium text-foreground">
            <BellRingIcon className="size-4" />
            Monitor
          </div>
          <p className="mt-1">A saved view that checks for new matches and can count or star them.</p>
        </li>
        <li>
          <div className="flex items-center gap-2 font-medium text-foreground">
            <SparklesIcon className="size-4" />
            Smart Digest
          </div>
          <p className="mt-1">A scheduled briefing you explicitly create from your chosen topic and sources.</p>
        </li>
      </ol>
    </section>
  )
}

import Link from "next/link"
import { ExternalLinkIcon } from "lucide-react"

import {
  buildStoryClusterTimelineComparison,
  type StoryClusterComparableSource,
} from "@/lib/story-cluster-comparison"
import { articleDetailHref } from "@/lib/reader-navigation"
import type {
  StoryClusterPresentation,
} from "@/lib/story-cluster-reader"

const timelineDateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
})

export function StoryClusterTimeline({
  cluster,
}: {
  cluster: StoryClusterPresentation
}) {
  const comparison = buildStoryClusterTimelineComparison(cluster.members)

  return (
    <section
      aria-label="Coverage timeline and source comparison"
      className="mt-4 rounded-md border bg-muted/20 p-3"
    >
      <h4 className="font-medium">Coverage timeline and source comparison</h4>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Publication order and exact headline wording from the cited original
        sources. Arctic RSS does not infer facts, corrections, or disagreements
        from headlines alone. All timestamps are shown in UTC.
      </p>

      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <SourceMoment
          label="First known article"
          source={comparison.firstKnownSource}
        />
        <SourceMoment
          label="Latest source update"
          source={comparison.latestKnownSource}
        />
      </dl>

      <ol className="mt-4 space-y-3 border-l pl-4">
        {comparison.sourcesByPublication.map((source) => (
          <li className="relative" key={source.articleId}>
            <span
              aria-hidden="true"
              className="absolute -left-[1.32rem] top-1.5 size-2 rounded-full bg-primary"
            />
            <SourceCitation source={source} />
          </li>
        ))}
      </ol>

      <section className="mt-4 border-t pt-3" aria-label="Headline framing">
        <h5 className="text-sm font-medium">Headline framing by source</h5>
        <p className="mt-1 text-xs text-muted-foreground">
          Compare the original wording directly; source perspective is not
          reduced to an ideological score.
        </p>
        <ul className="mt-2 space-y-2">
          {comparison.sourcesByPublication.map((source) => (
            <li className="text-sm" key={source.articleId}>
              <span className="font-medium">{source.feedTitle}:</span>{" "}
              <a
                className="underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                href={source.url}
                rel="noreferrer"
                target="_blank"
              >
                {source.title}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </section>
  )
}

function SourceMoment({
  label,
  source,
}: {
  label: string
  source: StoryClusterComparableSource | null
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1">
        {source ? (
          <SourceCitation source={source} />
        ) : (
          <span className="text-sm text-muted-foreground">
            Publication time unavailable
          </span>
        )}
      </dd>
    </div>
  )
}

function SourceCitation({ source }: { source: StoryClusterComparableSource }) {
  return (
    <div className="min-w-0 text-sm">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <Link
          className="font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          href={articleDetailHref(source.articleId)}
        >
          {source.title}
        </Link>
        <a
          aria-label={`Open original from ${source.feedTitle}`}
          className="inline-flex items-center text-muted-foreground hover:text-foreground"
          href={source.url}
          rel="noreferrer"
          target="_blank"
        >
          <ExternalLinkIcon className="size-3.5" />
        </a>
      </div>
      <p className="text-xs text-muted-foreground">
        {source.feedTitle} · {formatPublishedAt(source.publishedAt)}
      </p>
    </div>
  )
}

function formatPublishedAt(publishedAt: string | null) {
  if (!publishedAt) {
    return "Publication time unavailable"
  }

  const date = new Date(publishedAt)

  return Number.isFinite(date.getTime())
    ? timelineDateFormatter.format(date)
    : "Publication time unavailable"
}

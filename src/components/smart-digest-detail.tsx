import Link from "next/link"
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  Clock3Icon,
  ExternalLinkIcon,
  MailIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { articleDetailHref } from "@/lib/reader-navigation"

type SmartDigestDetailItem = {
  articleId: string | null
  articleTitle: string
  articleUrl: string
  feedTitle: string
  id: string
  matchedFields: string[]
  matchedTerms: string[]
  position: number
  publishedAt: Date | null
  reason: string
  summary: string
}

type SmartDigestDetailData = {
  articleCount: number
  completedAt: Date | null
  createdAt: Date
  emailErrorMessage: string | null
  emailStatus: "NOT_REQUESTED" | "PENDING" | "SENT" | "FAILED"
  errorMessage: string | null
  id: string
  items: SmartDigestDetailItem[]
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "COMPLETED_NO_MATCHES" | "FAILED"
  title: string
  topicPrompt: string
}

const digestDateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
})

export function SmartDigestDetail({
  digest,
}: {
  digest: SmartDigestDetailData
}) {
  if (digest.status === "PENDING" || digest.status === "PROCESSING") {
    return (
      <section className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2">
          <Clock3Icon className="size-4 text-muted-foreground" />
          <h2 className="font-heading text-base font-medium">
            Digest processing
          </h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Arctic RSS is checking your selected sources for matches.
        </p>
      </section>
    )
  }

  if (digest.status === "FAILED") {
    return (
      <section className="rounded-lg border border-destructive/30 bg-card p-4">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircleIcon className="size-4" />
          <h2 className="font-heading text-base font-medium">
            Smart Digest failed
          </h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {digest.errorMessage || "Arctic RSS could not generate this digest."}
        </p>
      </section>
    )
  }

  const groupedItems = groupItemsByFeed(digest.items)

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            <CheckCircle2Icon data-icon="inline-start" />
            {digest.status.toLowerCase().replaceAll("_", " ")}
          </Badge>
          <Badge variant="outline">
            <MailIcon data-icon="inline-start" />
            {digest.emailStatus.toLowerCase().replaceAll("_", " ")}
          </Badge>
          <Badge variant="outline">{digest.articleCount} articles</Badge>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          {digest.topicPrompt}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Generated{" "}
          {digestDateFormatter.format(digest.completedAt || digest.createdAt)}
        </p>
        {digest.emailErrorMessage && (
          <p className="mt-2 text-sm text-destructive">
            {digest.emailErrorMessage}
          </p>
        )}
      </section>

      {groupedItems.length ? (
        groupedItems.map(([feedTitle, items]) => (
          <section className="rounded-lg border bg-card" key={feedTitle}>
            <div className="flex items-center justify-between gap-3 border-b p-4">
              <h2 className="font-heading text-base font-medium">{feedTitle}</h2>
              <Badge variant="outline">{items.length}</Badge>
            </div>
            <div className="divide-y">
              {items.map((item) => (
                <article className="p-4" key={item.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    {item.articleId ? (
                      <Link
                        className="font-medium underline-offset-4 hover:underline"
                        href={articleDetailHref(item.articleId)}
                      >
                        {item.articleTitle}
                      </Link>
                    ) : (
                      <a
                        className="font-medium underline-offset-4 hover:underline"
                        href={item.articleUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {item.articleTitle}
                      </a>
                    )}
                    <a
                      aria-label="Open original"
                      className="inline-flex text-muted-foreground hover:text-foreground"
                      href={item.articleUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <ExternalLinkIcon className="size-4" />
                    </a>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.publishedAt
                      ? digestDateFormatter.format(item.publishedAt)
                      : "No publish date"}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {item.summary}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.matchedTerms.map((term) => (
                      <Badge key={term} variant="secondary">
                        {term}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {item.reason}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ))
      ) : (
        <section className="rounded-lg border bg-card p-4">
          <h2 className="font-heading text-base font-medium">No matches</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            No matching articles were found for this scheduled run.
          </p>
        </section>
      )}
    </div>
  )
}

function groupItemsByFeed(items: SmartDigestDetailItem[]) {
  const groups = new Map<string, SmartDigestDetailItem[]>()

  for (const item of items) {
    const existing = groups.get(item.feedTitle) ?? []
    existing.push(item)
    groups.set(item.feedTitle, existing)
  }

  return Array.from(groups.entries()).map(([feedTitle, groupedItems]) => [
    feedTitle,
    groupedItems.sort(
      (left, right) =>
        (right.publishedAt?.getTime() ?? 0) -
        (left.publishedAt?.getTime() ?? 0)
    ),
  ] as const)
}

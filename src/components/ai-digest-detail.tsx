import Link from "next/link"
import {
  AlertCircleIcon,
  BookOpenCheckIcon,
  Clock3Icon,
  ListFilterIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { articleDetailHref } from "@/lib/reader-navigation"

type DigestItem = {
  articleId: string | null
  articleTitle: string
  articleUrl: string
  feedTitle: string
  id: string
  position: number
  publishedAt: Date | null
  reason: string | null
  section: "MUST_READ" | "SKIM_LATER"
  summary: string
  topic: string
}

type DigestDetail = {
  articleCount: number
  completedAt: Date | null
  createdAt: Date
  errorMessage: string | null
  id: string
  items: DigestItem[]
  model: string | null
  overview: string | null
  provider: string | null
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED"
  title: string | null
}

const digestDateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
})

export function AiDigestDetail({ digest }: { digest: DigestDetail }) {
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
          Arctic RSS is grouping your newest unread articles. Refresh this page
          in a moment to see the completed digest.
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
            Digest generation failed
          </h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {digest.errorMessage || "Arctic RSS could not generate this digest."}
        </p>
      </section>
    )
  }

  const mustRead = digest.items.filter(
    (item) => item.section === "MUST_READ"
  )
  const skimLater = digest.items.filter(
    (item) => item.section === "SKIM_LATER"
  )

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{digest.articleCount} articles</Badge>
          {digest.provider && digest.model && (
            <Badge variant="outline">
              {digest.provider} · {digest.model}
            </Badge>
          )}
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          {digest.overview || "Your unread digest is ready."}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Generated{" "}
          {digestDateFormatter.format(digest.completedAt || digest.createdAt)}
        </p>
      </section>

      <DigestSection
        emptyMessage="No stories were selected as must-read."
        icon={BookOpenCheckIcon}
        items={mustRead}
        title="Must Read"
      />
      <DigestSection
        emptyMessage="No additional stories were queued for later."
        icon={ListFilterIcon}
        items={skimLater}
        title="Skim Later"
      />
    </div>
  )
}

function DigestSection({
  emptyMessage,
  icon: Icon,
  items,
  title,
}: {
  emptyMessage: string
  icon: typeof BookOpenCheckIcon
  items: DigestItem[]
  title: string
}) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-3 border-b p-4">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          <h2 className="font-heading text-base font-medium">{title}</h2>
        </div>
        <Badge variant="outline">{items.length}</Badge>
      </div>
      {items.length ? (
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
                <Badge variant="secondary">{item.topic}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.feedTitle}
                {item.publishedAt
                  ? ` · ${digestDateFormatter.format(item.publishedAt)}`
                  : ""}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {item.summary}
              </p>
              {item.reason && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {item.reason}
                </p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <p className="p-4 text-sm text-muted-foreground">{emptyMessage}</p>
      )}
    </section>
  )
}

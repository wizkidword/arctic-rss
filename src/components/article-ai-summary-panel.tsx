"use client"

import { useActionState } from "react"
import { RefreshCwIcon, SparklesIcon } from "lucide-react"

import {
  generateArticleSummaryAction,
  type GenerateArticleSummaryActionState,
} from "@/app/app/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { type ReaderArticleAiSummary } from "@/lib/articles"

const initialState: GenerateArticleSummaryActionState = {
  message: "",
  status: "idle",
}

export function ArticleAiSummaryPanel({
  articleId,
  summary,
}: {
  articleId: string
  summary: ReaderArticleAiSummary | null
}) {
  const [state, formAction, pending] = useActionState(
    generateArticleSummaryAction,
    initialState
  )
  const readingTime = formatReadingTime(summary?.readingTimeSeconds ?? null)

  return (
    <section
      aria-label="AI summary"
      className="rounded-lg border bg-muted/40 p-4 text-foreground"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <SparklesIcon className="size-4 text-primary" />
          <h3 className="text-sm font-semibold">AI Summary</h3>
          {summary && (
            <>
              <Badge variant="secondary">{summary.provider}</Badge>
              {summary.category && (
                <Badge variant="outline">{summary.category}</Badge>
              )}
              {readingTime && <Badge variant="outline">{readingTime}</Badge>}
            </>
          )}
        </div>
        <form action={formAction}>
          <input name="articleId" type="hidden" value={articleId} />
          <Button disabled={pending} size="sm" type="submit" variant="outline">
            {summary ? (
              <RefreshCwIcon data-icon="inline-start" />
            ) : (
              <SparklesIcon data-icon="inline-start" />
            )}
            {pending ? "Summarizing" : summary ? "Refresh" : "Generate"}
          </Button>
        </form>
      </div>

      {summary ? (
        <div className="mt-3 flex flex-col gap-3 text-sm leading-6">
          <p className="font-medium">{summary.shortSummary}</p>
          {summary.bulletSummary.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              {summary.bulletSummary.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          )}
          {summary.keyTakeaway && (
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Takeaway:</span>{" "}
              {summary.keyTakeaway}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">No summary yet.</p>
      )}

      {state.status !== "idle" && (
        <p
          aria-live="polite"
          className={
            state.status === "error"
              ? "mt-3 text-sm text-destructive"
              : "mt-3 text-sm text-muted-foreground"
          }
        >
          {state.message}
        </p>
      )}
    </section>
  )
}

function formatReadingTime(seconds: number | null) {
  if (!seconds) {
    return null
  }

  if (seconds < 60) {
    return `${seconds}s`
  }

  return `${Math.max(1, Math.round(seconds / 60))} min`
}

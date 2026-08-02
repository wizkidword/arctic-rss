"use client"

import { useActionState } from "react"
import Link from "next/link"
import { LoaderCircleIcon, WandSparklesIcon } from "lucide-react"

import {
  generateAiDigestAction,
  type GenerateAiDigestActionState,
} from "@/app/app/actions"
import { Button } from "@/components/ui/button"

const initialState: GenerateAiDigestActionState = {
  message: "",
  status: "idle",
}

export function AiDigestGenerator({
  activeDigest,
  dailyArticleCount,
  weeklyArticleCount,
}: {
  activeDigest: {
    id: string
    period?: "DAILY" | "WEEKLY"
    status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED"
  } | null
  dailyArticleCount: number
  weeklyArticleCount: number
}) {
  const [state, formAction, pending] = useActionState(
    generateAiDigestAction,
    initialState
  )
  const active = activeDigest ?? (
    state.digestId
      ? {
          id: state.digestId,
          period: state.period,
          status: "PENDING" as const,
        }
      : null
  )
  const disabled = pending || Boolean(active)
  const activeLabel = active?.period === "WEEKLY" ? "Weekly" : "Daily"
  const buttonLabel = pending
    ? "Starting briefing"
    : active
      ? `${activeLabel} briefing processing`
      : "Generate briefing"

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Choose a time window. Each briefing uses up to 20 recent unread stories
        and keeps the article links and selection reasons visible.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={disabled || dailyArticleCount === 0}
          name="period"
          type="submit"
          value="DAILY"
        >
          {pending ? (
            <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />
          ) : (
            <WandSparklesIcon data-icon="inline-start" />
          )}
          {buttonLabel === "Generate briefing"
            ? `Daily brief (${dailyArticleCount})`
            : buttonLabel}
        </Button>
        <Button
          disabled={disabled || weeklyArticleCount === 0}
          name="period"
          type="submit"
          value="WEEKLY"
          variant="outline"
        >
          {pending ? (
            <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />
          ) : (
            <WandSparklesIcon data-icon="inline-start" />
          )}
          {buttonLabel === "Generate briefing"
            ? `Weekly brief (${weeklyArticleCount})`
            : buttonLabel}
        </Button>
        {active && (
          <Link
            className="text-sm font-medium underline-offset-4 hover:underline"
            href={`/app/ai/digests/${encodeURIComponent(active.id)}`}
          >
            View active digest
          </Link>
        )}
      </div>
      {dailyArticleCount === 0 && weeklyArticleCount === 0 && !active && (
        <p className="text-sm text-muted-foreground">
          No unread stories were published in the last seven days.
        </p>
      )}
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
    </form>
  )
}

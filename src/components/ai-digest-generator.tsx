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
  eligibleArticleCount,
}: {
  activeDigest: {
    id: string
    status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED"
  } | null
  eligibleArticleCount: number
}) {
  const [state, formAction, pending] = useActionState(
    generateAiDigestAction,
    initialState
  )
  const active = activeDigest ?? (
    state.digestId
      ? {
          id: state.digestId,
          status: "PENDING" as const,
        }
      : null
  )
  const disabled = pending || Boolean(active) || eligibleArticleCount === 0
  const buttonLabel = pending
    ? "Starting digest"
    : active
      ? "Digest processing"
      : eligibleArticleCount === 0
        ? "No unread articles"
        : "Generate digest"

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {eligibleArticleCount} unread{" "}
        {eligibleArticleCount === 1 ? "article" : "articles"} eligible
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={disabled} type="submit">
          {pending ? (
            <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />
          ) : (
            <WandSparklesIcon data-icon="inline-start" />
          )}
          {buttonLabel}
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

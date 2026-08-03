"use client"

import { useActionState } from "react"
import { PauseIcon, PlayIcon } from "lucide-react"

import {
  setFeedPausedAction,
  type SetFeedPausedActionState,
} from "@/app/app/actions"
import { Button } from "@/components/ui/button"

const initialState: SetFeedPausedActionState = {
  message: "",
  status: "idle",
}

export function FeedPauseButton({
  isPaused,
  subscriptionId,
}: {
  isPaused: boolean
  subscriptionId: string
}) {
  const [state, action, pending] = useActionState(
    setFeedPausedAction,
    initialState
  )
  const actionLabel = isPaused ? "Resume feed" : "Pause feed"

  return (
    <form action={action} className="flex flex-col items-start gap-1 sm:items-end">
      <input name="subscriptionId" type="hidden" value={subscriptionId} />
      <input name="isPaused" type="hidden" value={String(!isPaused)} />
      <Button disabled={pending} type="submit" variant="outline">
        {isPaused ? (
          <PlayIcon data-icon="inline-start" />
        ) : (
          <PauseIcon data-icon="inline-start" />
        )}
        {pending ? (isPaused ? "Resuming" : "Pausing") : actionLabel}
      </Button>
      {state.status !== "idle" && (
        <p
          aria-live="polite"
          className={
            state.status === "error"
              ? "text-xs text-destructive"
              : "text-xs text-muted-foreground"
          }
        >
          {state.message}
        </p>
      )}
    </form>
  )
}

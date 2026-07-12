"use client"

import { useActionState } from "react"
import { RefreshCwIcon } from "lucide-react"

import {
  refreshFeedAction,
  type RefreshFeedActionState,
} from "@/app/app/actions"
import { Button } from "@/components/ui/button"

const initialState: RefreshFeedActionState = {
  message: "",
  status: "idle",
}

export function FeedRefreshButton({
  subscriptionId,
}: {
  subscriptionId: string
}) {
  const [state, action, pending] = useActionState(
    refreshFeedAction,
    initialState
  )

  return (
    <form action={action} className="flex flex-col items-start gap-1 sm:items-end">
      <input name="subscriptionId" type="hidden" value={subscriptionId} />
      <Button disabled={pending} type="submit" variant="outline">
        <RefreshCwIcon data-icon="inline-start" />
        {pending ? "Refreshing" : "Refresh"}
      </Button>
      {state.message && (
        <p
          aria-live="polite"
          className={
            state.status === "error"
              ? "max-w-56 text-xs text-destructive"
              : "max-w-56 text-xs text-muted-foreground"
          }
        >
          {state.message}
        </p>
      )}
    </form>
  )
}

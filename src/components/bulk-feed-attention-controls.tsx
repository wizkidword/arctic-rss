"use client"

import { useActionState } from "react"
import { PauseIcon, RefreshCwIcon, Trash2Icon } from "lucide-react"

import {
  bulkFeedAttentionAction,
  type BulkFeedAttentionActionState,
} from "@/app/app/actions"
import { Button } from "@/components/ui/button"

const initialState: BulkFeedAttentionActionState = {
  message: "",
  status: "idle",
}

export function BulkFeedAttentionControls({
  subscriptions,
}: {
  subscriptions: Array<{ id: string; title: string }>
}) {
  const [state, action, pending] = useActionState(
    bulkFeedAttentionAction,
    initialState
  )

  return (
    <form action={action} className="grid gap-3 border-t p-4">
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Select sources for a bulk action</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {subscriptions.map((subscription) => (
            <label className="flex items-center gap-2 text-sm" key={subscription.id}>
              <input name="subscriptionIds" type="checkbox" value={subscription.id} />
              {subscription.title}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={pending} name="operation" type="submit" value="retry" variant="outline">
          <RefreshCwIcon data-icon="inline-start" />
          Retry selected
        </Button>
        <Button disabled={pending} name="operation" type="submit" value="pause" variant="outline">
          <PauseIcon data-icon="inline-start" />
          Pause selected
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
        <label className="text-sm text-muted-foreground" htmlFor="bulk-unsubscribe-confirmation">
          To unsubscribe selected sources, type <span className="font-mono text-foreground">UNSUBSCRIBE</span>
        </label>
        <input
          className="h-8 rounded-md border bg-background px-2 text-sm"
          id="bulk-unsubscribe-confirmation"
          name="confirmation"
          placeholder="UNSUBSCRIBE"
        />
        <Button disabled={pending} name="operation" type="submit" value="unsubscribe" variant="destructive">
          <Trash2Icon data-icon="inline-start" />
          Unsubscribe selected
        </Button>
      </div>
      {state.status !== "idle" && (
        <p
          aria-live="polite"
          className={state.status === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}
        >
          {state.message}
        </p>
      )}
    </form>
  )
}

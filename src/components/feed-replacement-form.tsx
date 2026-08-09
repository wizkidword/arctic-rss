"use client"

import { useActionState } from "react"
import { ArrowRightLeftIcon } from "lucide-react"

import {
  replaceFeedSubscriptionAction,
  type ReplaceFeedSubscriptionActionState
} from "@/app/app/actions"
import { Button } from "@/components/ui/button"

const initialState: ReplaceFeedSubscriptionActionState = {
  message: "",
  status: "idle"
}

export function FeedReplacementForm({
  candidateUrl,
  mayBecomeOrphan,
  subscriptionId
}: {
  candidateUrl: string
  mayBecomeOrphan: boolean
  subscriptionId: string
}) {
  const [state, action, pending] = useActionState(replaceFeedSubscriptionAction, initialState)

  return (
    <form action={action} className="mt-3 grid gap-2 rounded-md border bg-muted/30 p-3">
      <input name="subscriptionId" type="hidden" value={subscriptionId} />
      <input name="candidateUrl" type="hidden" value={candidateUrl} />
      <p className="text-sm font-medium">Suggested replacement</p>
      <p className="break-all text-xs text-muted-foreground">{candidateUrl}</p>
      <p className="text-xs text-muted-foreground">
        Arctic RSS will safely rediscover this URL before changing your subscription. Your folder
        and custom title stay the same.
      </p>
      {mayBecomeOrphan ? (
        <p className="text-xs text-muted-foreground">
          This is your last subscription to the current source. Replacing it does not delete its
          retained articles or collection items.
        </p>
      ) : null}
      <label className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        Type <span className="font-mono text-foreground">REPLACE</span> to confirm
        <input
          className="h-8 w-28 rounded-md border bg-background px-2 text-sm text-foreground"
          name="confirmation"
          placeholder="REPLACE"
        />
      </label>
      <div>
        <Button disabled={pending} type="submit" variant="outline">
          <ArrowRightLeftIcon data-icon="inline-start" />
          {pending ? "Verifying replacement" : "Verify and replace"}
        </Button>
      </div>
      {state.status !== "idle" ? (
        <p
          aria-live="polite"
          className={
            state.status === "error" ? "text-xs text-destructive" : "text-xs text-muted-foreground"
          }
        >
          {state.message}
        </p>
      ) : null}
    </form>
  )
}

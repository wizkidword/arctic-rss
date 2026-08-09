"use client"

import { useActionState } from "react"
import { CheckIcon } from "lucide-react"

import { reviewFeedAttentionAction, type ReviewFeedAttentionActionState } from "@/app/app/actions"
import { Button } from "@/components/ui/button"

const initialState: ReviewFeedAttentionActionState = {
  message: "",
  status: "idle"
}

export function FeedAttentionReviewButton({ subscriptionId }: { subscriptionId: string }) {
  const [state, action, pending] = useActionState(reviewFeedAttentionAction, initialState)

  return (
    <form action={action} className="flex flex-col items-start gap-1 sm:items-end">
      <input name="subscriptionId" type="hidden" value={subscriptionId} />
      <Button disabled={pending} type="submit" variant="outline">
        <CheckIcon data-icon="inline-start" />
        {pending ? "Saving review" : "Mark reviewed"}
      </Button>
      {state.status !== "idle" ? (
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
      ) : null}
    </form>
  )
}

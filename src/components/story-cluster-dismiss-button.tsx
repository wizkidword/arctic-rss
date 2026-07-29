"use client"

import { useActionState } from "react"

import {
  dismissStoryClusterAction,
  type DismissStoryClusterActionState,
} from "@/app/app/actions"
import { Button } from "@/components/ui/button"

const initialState: DismissStoryClusterActionState = {
  message: "",
  status: "idle",
}

export function StoryClusterDismissButton({
  articleId,
  clusterId,
}: {
  articleId: string
  clusterId: string
}) {
  const [state, formAction, pending] = useActionState(
    dismissStoryClusterAction,
    initialState
  )

  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-center justify-end gap-2">
      <input name="articleId" type="hidden" value={articleId} />
      <input name="clusterId" type="hidden" value={clusterId} />
      <Button disabled={pending} size="sm" type="submit" variant="ghost">
        {pending ? "Dismissing" : "Dismiss group"}
      </Button>
      {state.status !== "idle" && (
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

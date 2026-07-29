"use client"

import { useActionState } from "react"

import {
  splitStoryClusterMemberAction,
  type SplitStoryClusterMemberActionState,
} from "@/app/app/actions"
import { Button } from "@/components/ui/button"

const initialState: SplitStoryClusterMemberActionState = {
  message: "",
  status: "idle",
}

export function StoryClusterSplitButton({
  articleId,
  clusterId,
  memberArticleId,
}: {
  articleId: string
  clusterId: string
  memberArticleId: string
}) {
  const [state, formAction, pending] = useActionState(
    splitStoryClusterMemberAction,
    initialState
  )

  return (
    <form action={formAction} className="mt-2 flex flex-wrap items-center gap-2">
      <input name="articleId" type="hidden" value={articleId} />
      <input name="clusterId" type="hidden" value={clusterId} />
      <input name="memberArticleId" type="hidden" value={memberArticleId} />
      <Button disabled={pending} size="sm" type="submit" variant="ghost">
        {pending ? "Separating" : "Separate source"}
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

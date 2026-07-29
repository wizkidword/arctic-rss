"use client"

import { useActionState } from "react"

import {
  mergeStoryClustersAction,
  type MergeStoryClustersActionState,
} from "@/app/app/actions"
import { Button } from "@/components/ui/button"
import type { StoryClusterPresentation } from "@/lib/story-cluster-reader"

const initialState: MergeStoryClustersActionState = {
  message: "",
  status: "idle",
}

export function StoryClusterMergeControl({
  articleId,
  clusters,
}: {
  articleId: string
  clusters: StoryClusterPresentation[]
}) {
  const [state, formAction, pending] = useActionState(
    mergeStoryClustersAction,
    initialState
  )

  if (clusters.length < 2) {
    return null
  }

  return (
    <form action={formAction} className="rounded-md border bg-muted/30 p-3">
      <input name="articleId" type="hidden" value={articleId} />
      <fieldset className="flex flex-col gap-3">
        <legend className="font-medium">Combine related-coverage groups</legend>
        <p className="text-xs text-muted-foreground">
          Choose two groups that describe the same story. They must share a
          visible source, and Arctic RSS keeps their named reasons in history.
        </p>
        <label className="flex flex-col gap-1 text-sm">
          First group
          <select className="rounded-md border bg-background px-2 py-1" name="firstClusterId">
            <option value="">Choose a group</option>
            {clusters.map((cluster, index) => (
              <option key={cluster.id} value={cluster.id}>
                {clusterOptionLabel(cluster, index)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Second group
          <select className="rounded-md border bg-background px-2 py-1" name="secondClusterId">
            <option value="">Choose a different group</option>
            {clusters.map((cluster, index) => (
              <option key={cluster.id} value={cluster.id}>
                {clusterOptionLabel(cluster, index)}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={pending} size="sm" type="submit" variant="outline">
            {pending ? "Merging" : "Merge groups"}
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
        </div>
      </fieldset>
    </form>
  )
}

function clusterOptionLabel(cluster: StoryClusterPresentation, index: number) {
  const sourceCount = cluster.members.length
  const firstTitle = cluster.members[0]?.title ?? "Saved coverage"

  return `Group ${index + 1}: ${sourceCount} ${sourceCount === 1 ? "source" : "sources"} — ${firstTitle}`
}

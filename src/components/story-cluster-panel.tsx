"use client"

import Link from "next/link"
import { useActionState } from "react"
import { RefreshCwIcon } from "lucide-react"

import {
  evaluateStoryClusterAction,
  type EvaluateStoryClusterActionState
} from "@/app/app/actions"
import { StoryClusterDismissButton } from "@/components/story-cluster-dismiss-button"
import { StoryClusterAnalysis } from "@/components/story-cluster-analysis"
import { StoryClusterMergeControl } from "@/components/story-cluster-merge-control"
import { StoryClusterSplitButton } from "@/components/story-cluster-split-button"
import { StoryClusterTimeline } from "@/components/story-cluster-timeline"
import { Button } from "@/components/ui/button"
import { articleDetailHref } from "@/lib/reader-navigation"
import type { StoryClusterSignal } from "@/lib/story-cluster-history"
import type { StoryClusterPresentation } from "@/lib/story-cluster-reader"

const initialState: EvaluateStoryClusterActionState = {
  message: "",
  status: "idle"
}

const signalLabels: Record<StoryClusterSignal, string> = {
  CANONICAL_URL: "the same canonical URL",
  NORMALIZED_TITLE: "matching normalized headlines",
  PUBLICATION_TIME_WINDOW: "publication within 72 hours",
  SHARED_NAMED_ENTITIES: "shared named entities",
  SOURCE_DUPLICATION: "source duplication",
  TEXT_SIMILARITY: "similar article text"
}

export function StoryClusterPanel({
  articleId,
  clusters
}: {
  articleId: string
  clusters: StoryClusterPresentation[]
}) {
  const [state, formAction, pending] = useActionState(
    evaluateStoryClusterAction,
    initialState
  )

  return (
    <details
      aria-label="Related coverage"
      className="group rounded-lg border bg-muted/25 text-foreground"
    >
      <summary className="flex cursor-pointer list-none flex-col gap-2 p-3 outline-none transition-colors hover:bg-muted/35 focus-visible:ring-3 focus-visible:ring-ring/50 sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-sm font-semibold">Related coverage</h3>
          <p className="text-xs text-muted-foreground">
            {clusters.length
              ? `${clusters.length} saved ${
                  clusters.length === 1 ? "story group" : "story groups"
                } with visible sources.`
              : "Find matching coverage without hiding the original article."}
          </p>
        </div>
        <span className="text-xs text-muted-foreground group-open:hidden">
          {clusters.length
            ? "Show sources and reasons"
            : "Check available coverage"}
        </span>
      </summary>

      <div className="flex flex-col gap-4 border-t p-4 text-sm leading-6">
        <p className="text-muted-foreground">
          Checking compares only your 50 newest visible articles. It preserves
          every original article and records named reasons rather than an opaque
          score.
        </p>
        <form action={formAction}>
          <input name="articleId" type="hidden" value={articleId} />
          <Button disabled={pending} size="sm" type="submit" variant="outline">
            <RefreshCwIcon data-icon="inline-start" />
            {pending
              ? "Checking"
              : clusters.length
                ? "Check again"
                : "Check related coverage"}
          </Button>
        </form>

        {clusters.map((cluster) => (
          <section
            className="rounded-md border bg-background p-3"
            key={cluster.id}
          >
            <p className="font-medium">
              {cluster.members.length}{" "}
              {cluster.members.length === 1 ? "source" : "sources"} on this
              story
            </p>
            <p className="mt-1 text-muted-foreground">
              <span className="font-medium text-foreground">
                Grouped because:
              </span>{" "}
              {cluster.reasons.map((reason) => signalLabels[reason]).join("; ")}
              .
            </p>
            <StoryClusterTimeline cluster={cluster} />
            <StoryClusterAnalysis articleId={articleId} cluster={cluster} />
            <ul className="mt-3 space-y-2 border-t pt-3">
              {cluster.members.map((member) => (
                <li key={member.articleId}>
                  <Link
                    className="block rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    href={articleDetailHref(member.articleId)}
                  >
                    <span className="font-medium">{member.title}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {member.feedTitle}
                    </span>
                  </Link>
                  {cluster.members.length > 2 ? (
                    <StoryClusterSplitButton
                      articleId={articleId}
                      clusterId={cluster.id}
                      memberArticleId={member.articleId}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
            {cluster.members.length > 2 ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Separate a source when it does not belong here. The remaining
                group must still have an explained connection.
              </p>
            ) : null}
            <StoryClusterDismissButton
              articleId={articleId}
              clusterId={cluster.id}
            />
          </section>
        ))}

        <StoryClusterMergeControl articleId={articleId} clusters={clusters} />

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
    </details>
  )
}

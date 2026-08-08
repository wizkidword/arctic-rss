"use client"

import Link from "next/link"
import { useActionState } from "react"
import { ExternalLinkIcon, SparklesIcon } from "lucide-react"

import {
  generateStoryClusterAnalysisAction,
  type GenerateStoryClusterAnalysisActionState,
} from "@/app/app/actions"
import { Button } from "@/components/ui/button"
import { articleDetailHref } from "@/lib/reader-navigation"
import type {
  StoryClusterAnalysisPresentation,
  StoryClusterPresentation,
  StoryClusterPresentationMember,
} from "@/lib/story-cluster-reader"

const initialState: GenerateStoryClusterAnalysisActionState = {
  message: "",
  status: "idle",
}

const claimLabels: Record<
  StoryClusterAnalysisPresentation["claims"][number]["kind"],
  string
> = {
  CORRECTION: "Correction",
  DISAGREEMENT: "Different accounts",
  LATEST_DEVELOPMENT: "Latest meaningful development",
  NEW_FACT: "New fact introduced",
  REPEATED_CLAIM: "Repeated claim",
}

export function StoryClusterAnalysis({
  articleId,
  cluster,
}: {
  articleId: string
  cluster: StoryClusterPresentation
}) {
  const [state, formAction, pending] = useActionState(
    generateStoryClusterAnalysisAction,
    initialState,
  )
  const sourcesByMemberId = new Map(
    cluster.members.map((member) => [member.memberId, member]),
  )

  return (
    <section
      aria-label="Optional cited AI comparison"
      className="mt-4 rounded-md border bg-muted/20 p-3"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h5 className="flex items-center gap-2 text-sm font-medium">
            <SparklesIcon className="size-3.5 text-primary" />
            Optional cited AI comparison
          </h5>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Runs only when you ask. Every generated statement links to its
            underlying original source and never replaces publisher wording;
            Arctic RSS does not assign ideological source scores.
          </p>
        </div>
      </div>

      {cluster.analysis ? (
        <StoredAnalysis
          analysis={cluster.analysis}
          sourceCount={cluster.members.length}
          sourcesByMemberId={sourcesByMemberId}
        />
      ) : (
        <form action={formAction} className="mt-3">
          <input name="articleId" type="hidden" value={articleId} />
          <input name="clusterId" type="hidden" value={cluster.id} />
          <Button disabled={pending} size="sm" type="submit" variant="outline">
            <SparklesIcon data-icon="inline-start" />
            {pending ? "Analyzing sources" : "Generate cited analysis"}
          </Button>
        </form>
      )}

      {state.status !== "idle" && (
        <p
          aria-live="polite"
          className={
            state.status === "error"
              ? "mt-3 text-sm text-destructive"
              : "mt-3 text-sm text-muted-foreground"
          }
        >
          {state.message}
        </p>
      )}
    </section>
  )
}

function StoredAnalysis({
  analysis,
  sourceCount,
  sourcesByMemberId,
}: {
  analysis: StoryClusterAnalysisPresentation
  sourceCount: number
  sourcesByMemberId: Map<string, StoryClusterPresentationMember>
}) {
  return (
    <div className="mt-3">
      <p className="text-xs text-muted-foreground">
        Generated with {analysis.provider} / {analysis.model} from {analysis.sourceCount < sourceCount ? "a chronological sample of " : "all "}{analysis.sourceCount} of {sourceCount} currently visible {sourceCount === 1 ? "source" : "sources"}.
      </p>
      <ol className="mt-3 space-y-3">
        {analysis.claims.map((claim, index) => (
          <li className="rounded-sm border bg-background p-3" key={`${claim.kind}-${index}`}>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {claimLabels[claim.kind]}
            </p>
            <p className="mt-1 text-sm leading-6 text-foreground">
              {claim.statement}
            </p>
            <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {claim.citations.flatMap((memberId) => {
                const source = sourcesByMemberId.get(memberId)

                return source ? [<SourceLink key={memberId} source={source} />] : []
              })}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  )
}

function SourceLink({ source }: { source: StoryClusterPresentationMember }) {
  return (
    <li className="flex items-center gap-1">
      <Link
        className="underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        href={articleDetailHref(source.articleId)}
      >
        {source.feedTitle}
      </Link>
      <a
        aria-label={`Open original from ${source.feedTitle}`}
        className="text-muted-foreground hover:text-foreground"
        href={source.url}
        rel="noreferrer"
        target="_blank"
      >
        <ExternalLinkIcon className="size-3" />
      </a>
    </li>
  )
}

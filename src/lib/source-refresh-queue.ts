export type SourceRefreshTrigger =
  | "scheduler"
  | "manual"
  | "source-attention"
  | "source-hygiene-replacement"
  | "subscription-initial-retry"
  | "opml-retry"

export type SourceRefreshEnqueueResult = {
  jobId: string
  outcome: "already-queued" | "queued"
}

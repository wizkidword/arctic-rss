export type SourceRefreshTrigger =
  | "scheduler"
  | "manual"
  | "source-attention"
  | "subscription-initial-retry"
  | "opml-retry"

export type SourceRefreshEnqueueResult = {
  jobId: string
  outcome: "already-queued" | "queued"
}

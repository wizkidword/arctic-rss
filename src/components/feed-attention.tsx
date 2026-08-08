import { AlertCircleIcon, RssIcon } from "lucide-react"

import { FeedPauseButton } from "@/components/feed-pause-button"
import { FeedRefreshButton } from "@/components/feed-refresh-button"
import { FeedUnsubscribeButton } from "@/components/feed-unsubscribe-button"
import { BulkFeedAttentionControls } from "@/components/bulk-feed-attention-controls"

export type FeedAttentionSubscription = {
  id: string
  isPaused: boolean
  lastError: string | null
  lastSuccessfulFetchAt: Date | null
  title: string
}

export function FeedAttentionList({
  subscriptions,
}: {
  subscriptions: FeedAttentionSubscription[]
}) {
  const attentionSubscriptions = subscriptions.filter(
    (subscription) => Boolean(subscription.lastError) && !subscription.isPaused
  )

  if (!attentionSubscriptions.length) {
    return null
  }

  return (
    <section aria-label="Sources needing attention" className="rounded-lg border border-destructive/30 bg-card">
      <div className="flex items-center justify-between gap-3 border-b p-4">
        <div>
          <div className="flex items-center gap-2">
            <AlertCircleIcon className="size-4 text-destructive" />
            <h2 className="font-heading text-base font-medium">Sources needing attention</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            These active sources could not be refreshed. Retry first, then pause or unsubscribe if the problem continues.
          </p>
        </div>
        <span className="text-sm tabular-nums text-muted-foreground">
          {attentionSubscriptions.length}
        </span>
      </div>
      <div className="divide-y">
        {attentionSubscriptions.map((subscription) => (
          <article
            className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto]"
            key={subscription.id}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-medium">
                <RssIcon className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{subscription.title}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {feedAttentionSummary(subscription)}
              </p>
            </div>
            <div className="flex flex-wrap items-start gap-2">
              <FeedRefreshButton subscriptionId={subscription.id} />
              <FeedPauseButton isPaused={false} subscriptionId={subscription.id} />
              <FeedUnsubscribeButton
                feedTitle={subscription.title}
                subscriptionId={subscription.id}
              />
            </div>
          </article>
        ))}
      </div>
      <BulkFeedAttentionControls
        subscriptions={attentionSubscriptions.map(({ id, title }) => ({ id, title }))}
      />
    </section>
  )
}

export function feedAttentionSummary(
  subscription: Pick<FeedAttentionSubscription, "lastError" | "lastSuccessfulFetchAt">,
  now = new Date()
) {
  const age = lastSuccessfulAge(subscription.lastSuccessfulFetchAt, now)
  const reason = normalizedFeedFailureReason(subscription.lastError)

  return age ? `${reason} Last successful update ${age}.` : `${reason} No successful update is recorded yet.`
}

function normalizedFeedFailureReason(error: string | null) {
  const normalized = error?.toLowerCase() ?? ""

  if (/\b404\b|not found|gone/.test(normalized)) {
    return "The source may have moved or no longer exists."
  }
  if (/\b401\b|\b403\b|forbidden|unauthorized|access denied/.test(normalized)) {
    return "The source is blocking access right now."
  }
  if (/timeout|timed out|etimedout/.test(normalized)) {
    return "The source took too long to respond."
  }
  if (/certificate|tls|ssl/.test(normalized)) {
    return "The source has a secure-connection problem."
  }

  return "Arctic RSS could not refresh this source."
}

function lastSuccessfulAge(lastSuccessfulFetchAt: Date | null, now: Date) {
  if (!lastSuccessfulFetchAt) {
    return null
  }

  const elapsedDays = Math.max(
    0,
    Math.floor((now.getTime() - lastSuccessfulFetchAt.getTime()) / 86_400_000)
  )

  if (elapsedDays === 0) {
    return "was today"
  }

  return `was ${elapsedDays} ${elapsedDays === 1 ? "day" : "days"} ago`
}

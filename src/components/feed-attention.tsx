import { AlertCircleIcon, CheckCircle2Icon, RssIcon } from "lucide-react"

import { FeedAttentionReviewButton } from "@/components/feed-attention-review-button"
import { FeedPauseButton } from "@/components/feed-pause-button"
import { FeedRefreshButton } from "@/components/feed-refresh-button"
import { FeedReplacementForm } from "@/components/feed-replacement-form"
import { FeedUnsubscribeButton } from "@/components/feed-unsubscribe-button"
import { BulkFeedAttentionControls } from "@/components/bulk-feed-attention-controls"

export type FeedAttentionSubscription = {
  feedUrl: string
  id: string
  isPaused: boolean
  lastError: string | null
  lastFeedSelfUrl: string | null
  lastPermanentRedirectUrl: string | null
  lastRecoveredAt: Date | null
  lastResolvedFeedUrl: string | null
  lastSuccessfulFetchAt: Date | null
  lastSourceAttentionReviewedAt: Date | null
  previousFeedSelfUrl: string | null
  previousFeedUrl: string | null
  previousResolvedFeedUrl: string | null
  sourceSubscriberCount: number
  title: string
}

export function FeedAttentionList({
  subscriptions,
}: {
  subscriptions: FeedAttentionSubscription[]
}) {
  const attentionSubscriptions = subscriptions.filter(needsAttention)
  const failedSubscriptions = attentionSubscriptions.filter(
    (subscription) => !isRecoveredSinceReview(subscription)
  )

  if (!attentionSubscriptions.length) {
    return null
  }

  return (
    <section
      aria-label="Sources needing attention"
      className="rounded-lg border border-destructive/30 bg-card"
    >
      <div className="flex items-center justify-between gap-3 border-b p-4">
        <div>
          <div className="flex items-center gap-2">
            <AlertCircleIcon className="size-4 text-destructive" />
            <h2 className="font-heading text-base font-medium">
              Sources needing attention
            </h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Retry queues a background refresh. Any replacement stays a preview
            until you explicitly confirm it.
          </p>
        </div>
        <span className="text-sm tabular-nums text-muted-foreground">
          {attentionSubscriptions.length}
        </span>
      </div>
      <div className="divide-y">
        {attentionSubscriptions.map((subscription) => {
          const recovered = isRecoveredSinceReview(subscription)
          const hygiene = sourceHygiene(subscription, subscriptions)

          return (
            <article
              className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto]"
              key={subscription.id}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-medium">
                  {recovered ? (
                    <CheckCircle2Icon className="size-4 shrink-0 text-emerald-600" />
                  ) : (
                    <RssIcon className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="truncate">{subscription.title}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {recovered
                    ? feedRecoverySummary(subscription)
                    : feedAttentionSummary(subscription)}
                </p>
                <SourceHygieneDetails hygiene={hygiene} />
                {!recovered && hygiene.candidateUrl && !hygiene.duplicateTitle ? (
                  <FeedReplacementForm
                    candidateUrl={hygiene.candidateUrl}
                    mayBecomeOrphan={subscription.sourceSubscriberCount === 1}
                    subscriptionId={subscription.id}
                  />
                ) : null}
              </div>
              <div className="flex flex-wrap items-start gap-2">
                {recovered ? (
                  <FeedAttentionReviewButton subscriptionId={subscription.id} />
                ) : (
                  <>
                    <FeedRefreshButton subscriptionId={subscription.id} />
                    <FeedPauseButton
                      isPaused={false}
                      subscriptionId={subscription.id}
                    />
                    <FeedUnsubscribeButton
                      feedTitle={subscription.title}
                      subscriptionId={subscription.id}
                    />
                  </>
                )}
              </div>
            </article>
          )
        })}
      </div>
      {failedSubscriptions.length ? (
        <BulkFeedAttentionControls
          subscriptions={failedSubscriptions.map(({ id, title }) => ({ id, title }))}
        />
      ) : null}
    </section>
  )
}

function SourceHygieneDetails({ hygiene }: { hygiene: SourceHygiene }) {
  if (!hygiene.notes.length && !hygiene.duplicateTitle) {
    return null
  }

  return (
    <div className="mt-3 grid gap-1 border-l-2 border-muted pl-3 text-xs text-muted-foreground">
      {hygiene.notes.map((note) => (
        <p key={note}>{note}</p>
      ))}
      {hygiene.duplicateTitle ? (
        <p>
          You already follow a matching source as {hygiene.duplicateTitle}. No
          replacement will be made.
        </p>
      ) : null}
    </div>
  )
}

type SourceHygiene = {
  candidateUrl: string | null
  duplicateTitle: string | null
  notes: string[]
}

export function sourceHygiene(
  subscription: FeedAttentionSubscription,
  subscriptions: FeedAttentionSubscription[]
): SourceHygiene {
  const notes = [`Current source URL: ${subscription.feedUrl}`]

  if (subscription.previousFeedUrl) {
    notes.push(`Prior subscription URL: ${subscription.previousFeedUrl}`)
  }
  if (
    subscription.lastResolvedFeedUrl &&
    !sameSourceUrl(subscription.lastResolvedFeedUrl, subscription.feedUrl)
  ) {
    notes.push(`Latest response URL: ${subscription.lastResolvedFeedUrl}`)
  }
  if (subscription.previousResolvedFeedUrl) {
    notes.push(`Prior response URL: ${subscription.previousResolvedFeedUrl}`)
  }
  if (subscription.lastPermanentRedirectUrl) {
    notes.push(
      `A permanent redirect was observed to: ${subscription.lastPermanentRedirectUrl}`
    )
  }
  if (subscription.lastFeedSelfUrl) {
    notes.push(`Feed self-link: ${subscription.lastFeedSelfUrl}`)
  }
  if (subscription.previousFeedSelfUrl) {
    notes.push(`Prior feed self-link: ${subscription.previousFeedSelfUrl}`)
  }

  const candidateUrl = suggestedReplacementUrl(subscription)
  const duplicate = candidateUrl
    ? subscriptions.find(
        (other) =>
          other.id !== subscription.id &&
          [other.feedUrl, other.lastResolvedFeedUrl, other.lastFeedSelfUrl].some(
            (url) => url && sameSourceUrl(url, candidateUrl)
          )
      )
    : undefined

  return {
    candidateUrl,
    duplicateTitle: duplicate?.title ?? null,
    notes,
  }
}

export function suggestedReplacementUrl(
  subscription: Pick<
    FeedAttentionSubscription,
    "feedUrl" | "lastFeedSelfUrl" | "lastPermanentRedirectUrl"
  >
) {
  const candidates = [
    subscription.lastPermanentRedirectUrl,
    subscription.lastFeedSelfUrl,
  ]

  return (
    candidates.find(
      (candidate): candidate is string =>
        Boolean(candidate) && !sameSourceUrl(candidate!, subscription.feedUrl)
    ) ?? null
  )
}

export function needsAttention(subscription: FeedAttentionSubscription) {
  return (
    (!subscription.isPaused && Boolean(subscription.lastError)) ||
    isRecoveredSinceReview(subscription)
  )
}

export function isRecoveredSinceReview(
  subscription: Pick<
    FeedAttentionSubscription,
    "isPaused" | "lastError" | "lastRecoveredAt" | "lastSourceAttentionReviewedAt"
  >
) {
  return Boolean(
    !subscription.isPaused &&
      !subscription.lastError &&
      subscription.lastRecoveredAt &&
      (!subscription.lastSourceAttentionReviewedAt ||
        subscription.lastRecoveredAt > subscription.lastSourceAttentionReviewedAt)
  )
}

export function feedAttentionSummary(
  subscription: Pick<FeedAttentionSubscription, "lastError" | "lastSuccessfulFetchAt">,
  now = new Date()
) {
  const age = lastSuccessfulAge(subscription.lastSuccessfulFetchAt, now)
  const reason = normalizedFeedFailureReason(subscription.lastError)

  return age
    ? `${reason} Last successful update ${age}.`
    : `${reason} No successful update is recorded yet.`
}

export function feedRecoverySummary(
  subscription: Pick<FeedAttentionSubscription, "lastSuccessfulFetchAt">,
  now = new Date()
) {
  const age = lastSuccessfulAge(subscription.lastSuccessfulFetchAt, now)

  return age
    ? `This source recovered. Its last successful update ${age}.`
    : "This source recovered. Mark it reviewed when you are satisfied."
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

function sameSourceUrl(first: string, second: string) {
  try {
    return new URL(first).href === new URL(second).href
  } catch {
    return first === second
  }
}

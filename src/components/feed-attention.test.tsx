import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/feed-pause-button", () => ({
  FeedPauseButton: () => <button>Pause</button>,
}))
vi.mock("@/components/feed-refresh-button", () => ({
  FeedRefreshButton: () => <button>Retry</button>,
}))
vi.mock("@/components/feed-unsubscribe-button", () => ({
  FeedUnsubscribeButton: () => <button>Unsubscribe</button>,
}))
vi.mock("@/components/feed-attention-review-button", () => ({
  FeedAttentionReviewButton: () => <button>Mark reviewed</button>,
}))
vi.mock("@/components/feed-replacement-form", () => ({
  FeedReplacementForm: () => <button>Verify and replace</button>,
}))
vi.mock("@/components/bulk-feed-attention-controls", () => ({
  BulkFeedAttentionControls: () => <div>Bulk source controls</div>,
}))

import { FeedAttentionList, feedAttentionSummary } from "./feed-attention"

function attentionSubscription(
  values: Partial<Parameters<typeof FeedAttentionList>[0]["subscriptions"][number]>
) {
  return {
    feedUrl: "https://example.com/feed.xml",
    id: "subscription-1",
    isPaused: false,
    lastError: null,
    lastFeedSelfUrl: null,
    lastPermanentRedirectUrl: null,
    lastRecoveredAt: null,
    lastResolvedFeedUrl: null,
    lastSuccessfulFetchAt: null,
    lastSourceAttentionReviewedAt: null,
    previousFeedSelfUrl: null,
    previousFeedUrl: null,
    previousResolvedFeedUrl: null,
    sourceSubscriberCount: 2,
    title: "Example source",
    ...values,
  }
}

describe("FeedAttentionList", () => {
  it("shows only active failed sources and never exposes a raw failure", () => {
    const markup = renderToStaticMarkup(
      <FeedAttentionList
        subscriptions={[
          attentionSubscription({
            id: "failed",
            isPaused: false,
            lastError: "ETIMEDOUT 10.0.0.4 https://private.example/feed",
            lastSuccessfulFetchAt: new Date("2026-08-04T12:00:00.000Z"),
            title: "Slow source",
          }),
          attentionSubscription({
            id: "recovered",
            isPaused: false,
            lastError: null,
            lastSuccessfulFetchAt: new Date("2026-08-07T12:00:00.000Z"),
            title: "Recovered source",
          }),
          attentionSubscription({
            id: "paused",
            isPaused: true,
            lastError: "404",
            lastSuccessfulFetchAt: null,
            title: "Paused source",
          }),
        ]}
      />
    )

    expect(markup).toContain("Slow source")
    expect(markup).toContain("took too long to respond")
    expect(markup).not.toContain("10.0.0.4")
    expect(markup).not.toContain("Recovered source")
    expect(markup).not.toContain("Paused source")
    expect(markup).toContain("Retry")
    expect(markup).toContain("Pause")
    expect(markup).toContain("Unsubscribe")
  })

  it("describes a last successful update in simple language", () => {
    expect(
      feedAttentionSummary(
        {
          lastError: "404",
          lastSuccessfulFetchAt: new Date("2026-08-04T12:00:00.000Z"),
        },
        new Date("2026-08-08T12:00:00.000Z")
      )
    ).toBe("The source may have moved or no longer exists. Last successful update was 4 days ago.")
  })

  it("shows verified replacement evidence but avoids a duplicate source", () => {
    const markup = renderToStaticMarkup(
      <FeedAttentionList
        subscriptions={[
          attentionSubscription({
            id: "failed",
            lastError: "404",
            lastFeedSelfUrl: "https://feeds.example.com/self.xml",
            lastPermanentRedirectUrl: "https://feeds.example.com/current.xml",
            lastResolvedFeedUrl: "https://feeds.example.com/current.xml",
            title: "Moved source",
          }),
          attentionSubscription({
            feedUrl: "https://feeds.example.com/current.xml",
            id: "existing",
            title: "Existing source",
          }),
        ]}
      />
    )

    expect(markup).toContain(
      "A permanent redirect was observed to: https://feeds.example.com/current.xml"
    )
    expect(markup).toContain("Feed self-link: https://feeds.example.com/self.xml")
    expect(markup).toContain("You already follow a matching source as Existing source")
    expect(markup).not.toContain("Verify and replace")
  })

  it("keeps a recovered source visible until the reader marks it reviewed", () => {
    const markup = renderToStaticMarkup(
      <FeedAttentionList
        subscriptions={[
          attentionSubscription({
            id: "recovered",
            lastRecoveredAt: new Date("2026-08-09T14:30:00.000Z"),
            lastSuccessfulFetchAt: new Date("2026-08-09T14:30:00.000Z"),
            title: "Recovered source",
          }),
        ]}
      />
    )

    expect(markup).toContain("Recovered source")
    expect(markup).toContain("This source recovered")
    expect(markup).toContain("Mark reviewed")
    expect(markup).not.toContain("Bulk source controls")
  })
})

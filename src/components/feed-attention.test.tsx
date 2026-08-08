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
vi.mock("@/components/bulk-feed-attention-controls", () => ({
  BulkFeedAttentionControls: () => <div>Bulk source controls</div>,
}))

import { FeedAttentionList, feedAttentionSummary } from "./feed-attention"

describe("FeedAttentionList", () => {
  it("shows only active failed sources and never exposes a raw failure", () => {
    const markup = renderToStaticMarkup(
      <FeedAttentionList
        subscriptions={[
          {
            id: "failed",
            isPaused: false,
            lastError: "ETIMEDOUT 10.0.0.4 https://private.example/feed",
            lastSuccessfulFetchAt: new Date("2026-08-04T12:00:00.000Z"),
            title: "Slow source",
          },
          {
            id: "recovered",
            isPaused: false,
            lastError: null,
            lastSuccessfulFetchAt: new Date("2026-08-07T12:00:00.000Z"),
            title: "Recovered source",
          },
          {
            id: "paused",
            isPaused: true,
            lastError: "404",
            lastSuccessfulFetchAt: null,
            title: "Paused source",
          },
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
})

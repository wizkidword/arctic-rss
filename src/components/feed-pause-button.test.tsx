import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/app/app/actions", () => ({
  setFeedPausedAction: vi.fn(),
}))

import { FeedPauseButton } from "./feed-pause-button"

describe("FeedPauseButton", () => {
  it("offers a pause action for an active feed", () => {
    const markup = renderToStaticMarkup(
      <FeedPauseButton isPaused={false} subscriptionId="subscription-1" />
    )

    expect(markup).toContain("Pause feed")
    expect(markup).toContain('name="subscriptionId"')
    expect(markup).toContain('value="subscription-1"')
    expect(markup).toContain('name="isPaused"')
    expect(markup).toContain('value="true"')
  })

  it("offers a resume action for a paused feed", () => {
    const markup = renderToStaticMarkup(
      <FeedPauseButton isPaused subscriptionId="subscription-1" />
    )

    expect(markup).toContain("Resume feed")
    expect(markup).toContain('value="false"')
  })
})

/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest"

import { trackAnalyticsEvent } from "./google-analytics-events"

type TestWindow = Window & {
  gtag?: ReturnType<typeof vi.fn>
}

describe("trackAnalyticsEvent", () => {
  afterEach(() => {
    delete (window as TestWindow).gtag
  })

  it("sends privacy-safe custom events to Google Analytics", () => {
    const gtag = vi.fn()
    ;(window as TestWindow).gtag = gtag

    trackAnalyticsEvent("first_source_subscribed", {
      empty: undefined,
      source_type: "feed",
    })

    expect(gtag).toHaveBeenCalledWith("event", "first_source_subscribed", {
      source_type: "feed",
    })
  })

  it("does nothing when Google Analytics has not loaded", () => {
    expect(() => {
      trackAnalyticsEvent("create_account_click", {
        link_location: "landing_hero",
      })
    }).not.toThrow()
  })
})

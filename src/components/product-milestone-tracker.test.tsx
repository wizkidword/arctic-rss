/** @vitest-environment jsdom */

import { render, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  trackAnalyticsEvent: vi.fn(),
}))

vi.mock("@/lib/google-analytics-events", () => ({
  trackAnalyticsEvent: mocks.trackAnalyticsEvent,
}))

import { ProductMilestoneTracker } from "./product-milestone-tracker"

describe("ProductMilestoneTracker", () => {
  afterEach(() => {
    mocks.trackAnalyticsEvent.mockReset()
    document.cookie = "arcticrss_product_milestones=; Max-Age=0; Path=/app"
  })

  it("emits only supplied fixed milestone names and clears the handoff cookie", async () => {
    document.cookie = "arcticrss_product_milestones=first_article_opened; Path=/app"

    render(
      <ProductMilestoneTracker
        milestones={["first_article_opened", "first_collection_saved"]}
      />
    )

    await waitFor(() => {
      expect(mocks.trackAnalyticsEvent).toHaveBeenNthCalledWith(
        1,
        "first_article_opened"
      )
      expect(mocks.trackAnalyticsEvent).toHaveBeenNthCalledWith(
        2,
        "first_collection_saved"
      )
    })
    expect(document.cookie).not.toContain("arcticrss_product_milestones")
  })
})

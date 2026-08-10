import { describe, expect, it, vi } from "vitest"

import {
  parseMobileProductMilestone,
  recordMobileProductMilestone,
} from "./telemetry"

describe("mobile product telemetry", () => {
  it("accepts only the two fixed Android milestones", () => {
    expect(
      parseMobileProductMilestone(
        new Headers({
          "x-arctic-rss-client-platform": "android",
          "x-arctic-rss-product-milestone": "first_mobile_sync",
        })
      )
    ).toBe("first_mobile_sync")
    expect(
      parseMobileProductMilestone(
        new Headers({
          "x-arctic-rss-client-platform": "android",
          "x-arctic-rss-product-milestone": "article-title-must-never-log",
        })
      )
    ).toBeUndefined()
  })

  it("writes an aggregate record without a user or device identifier", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {})

    recordMobileProductMilestone("first_return_session")

    expect(JSON.parse(String(info.mock.calls[0][0]))).toEqual({
      event: "mobile_product_milestone",
      milestone: "first_return_session",
      platform: "android",
    })
    info.mockRestore()
  })
})

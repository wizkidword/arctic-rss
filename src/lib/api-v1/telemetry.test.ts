import { describe, expect, it, vi } from "vitest"

import {
  parseMobileProductMilestone,
  recordApiV1Request,
  recordMobileProductMilestone,
  recordMobileQueueConflict,
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

  it("records a bounded API response class without a request identifier", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {})

    recordApiV1Request({
      authMode: "device-session",
      durationMs: 14,
      endpoint: "sync",
      pageSize: 50,
      rateLimitResult: "allowed",
      statusCode: 200,
    })

    expect(JSON.parse(String(info.mock.calls[0][0]))).toEqual({
      authMode: "device-session",
      durationMs: 14,
      endpoint: "sync",
      event: "mobile_api_v1_request",
      pageSize: 50,
      rateLimitResult: "allowed",
      responseClass: "2xx",
      statusCode: 200,
    })
    info.mockRestore()
  })

  it("records queue conflicts with a fixed outcome and no identifier", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {})

    recordMobileQueueConflict("resource_not_found")

    expect(JSON.parse(String(info.mock.calls[0][0]))).toEqual({
      event: "mobile_queue_conflict",
      outcome: "resource_not_found",
    })
    info.mockRestore()
  })
})

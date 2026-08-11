import { describe, expect, it, vi } from "vitest"

import {
  recordMobileAuthorizationDecision,
  recordMobileJournalRetention,
  recordMobileSyncPage,
  recordMobileTokenRefresh,
} from "./mobile-telemetry"

describe("mobile operational telemetry", () => {
  it("records only fixed authorization and refresh outcomes", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {})

    recordMobileAuthorizationDecision("approved")
    recordMobileTokenRefresh("reuse_detected")

    expect(info.mock.calls.map(([value]) => JSON.parse(String(value)))).toEqual([
      { decision: "approved", event: "mobile_authorization_decision" },
      { event: "mobile_token_refresh", outcome: "reuse_detected" },
    ])
    info.mockRestore()
  })

  it("rounds sync measurements without including a request or owner identifier", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {})

    recordMobileSyncPage({
      durationMs: 12.6,
      eventCount: 2.4,
      fullResyncRequired: false,
      hasMore: true,
    })

    expect(JSON.parse(String(info.mock.calls[0][0]))).toEqual({
      durationMs: 13,
      event: "mobile_sync_page",
      eventCount: 2,
      fullResyncRequired: false,
      hasMore: true,
    })
    info.mockRestore()
  })

  it("records stable-device and journal aggregates without a timestamp or identifier", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {})

    recordMobileJournalRetention({
      activeStableDeviceCount: 3,
      oldestRetainedEventAgeMs: 95.8,
      retainedEvents: 42,
      rowsPruned: 2,
    })

    expect(JSON.parse(String(info.mock.calls[0][0]))).toEqual({
      activeStableDeviceCount: 3,
      event: "mobile_sync_journal",
      oldestRetainedEventAgeMs: 96,
      retainedEvents: 42,
      rowsPruned: 2,
    })
    info.mockRestore()
  })
})

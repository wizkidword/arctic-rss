/** @vitest-environment jsdom */

import { describe, expect, it } from "vitest"

import {
  ANALYTICS_CONSENT_MAX_AGE_MS,
  ANALYTICS_CONSENT_STORAGE_KEY,
  readAnalyticsConsent,
  writeAnalyticsConsent,
} from "./analytics-consent"

describe("analytics consent storage", () => {
  it("stores affirmative consent and expires it after 180 days", () => {
    const now = new Date("2026-07-14T12:00:00.000Z")
    writeAnalyticsConsent(window.localStorage, "accepted", now)

    expect(readAnalyticsConsent(window.localStorage, now.getTime())).toBe("accepted")
    expect(
      readAnalyticsConsent(window.localStorage, now.getTime() + ANALYTICS_CONSENT_MAX_AGE_MS + 1)
    ).toBeNull()
  })

  it("rejects malformed browser storage", () => {
    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "not-json")

    expect(readAnalyticsConsent(window.localStorage)).toBeNull()
  })
})

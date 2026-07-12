import { afterEach, describe, expect, it, vi } from "vitest"

import { getGoogleAnalyticsMeasurementId } from "./google-analytics"

describe("google analytics configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("normalizes the public GA4 measurement id", () => {
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "  G-ABC123XYZ9  ")

    expect(getGoogleAnalyticsMeasurementId()).toBe("G-ABC123XYZ9")
  })

  it("stays disabled when no measurement id is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "")

    expect(getGoogleAnalyticsMeasurementId()).toBe("")
  })
})

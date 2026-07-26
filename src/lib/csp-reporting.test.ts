import { describe, expect, it, vi } from "vitest"

import {
  aggregateCspViolationReports,
  isCspViolationSample,
  type CspReportCounterStore,
} from "./csp-reporting"

function createCounterStore() {
  const counters = new Map<string, number>()

  const store: CspReportCounterStore = {
    eval: vi.fn(async (_script, _numberOfKeys, key) => {
      const count = (counters.get(String(key)) ?? 0) + 1
      counters.set(String(key), count)
      return count
    }),
  }

  return store
}

describe("CSP report aggregation", () => {
  it("logs a new signature, suppresses duplicates, and logs elevated counts", async () => {
    const store = createCounterStore()
    const report = {
      blockedUri: "https://tracker.example",
      disposition: "enforce",
      documentUri: "https://arcticrss.com",
      effectiveDirective: "img-src",
      violatedDirective: "img-src 'self'",
    }

    await expect(
      aggregateCspViolationReports([report], { store })
    ).resolves.toEqual([
      {
        count: 1,
        directive: "img-src",
        source: "https://tracker.example",
      },
    ])

    for (let attempt = 0; attempt < 8; attempt += 1) {
      await expect(
        aggregateCspViolationReports([report], { store })
      ).resolves.toEqual([])
    }

    await expect(
      aggregateCspViolationReports([report], { store })
    ).resolves.toEqual([
      {
        count: 10,
        directive: "img-src",
        source: "https://tracker.example",
      },
    ])
  })

  it("uses logarithmic samples after the first observation", () => {
    expect(isCspViolationSample(1)).toBe(true)
    expect(isCspViolationSample(2)).toBe(false)
    expect(isCspViolationSample(10)).toBe(true)
    expect(isCspViolationSample(100)).toBe(true)
    expect(isCspViolationSample(101)).toBe(false)
  })
})

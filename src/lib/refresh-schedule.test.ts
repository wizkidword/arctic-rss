import { describe, expect, it } from "vitest"

import {
  nextFetchAt,
  readClampedPositiveInteger,
} from "./refresh-schedule"

describe("refresh schedule", () => {
  it("uses a deterministic base interval at the clock boundary", () => {
    const now = new Date("2026-07-13T12:00:00.000Z")

    expect(
      nextFetchAt({
        consecutiveFailures: 0,
        now,
        random: () => 0.5,
        refreshIntervalMinutes: 60,
      })
    ).toEqual(new Date("2026-07-13T13:00:00.000Z"))
  })

  it("backs off failed feeds exponentially", () => {
    const now = new Date("2026-07-13T12:00:00.000Z")

    expect(
      nextFetchAt({
        consecutiveFailures: 3,
        now,
        random: () => 0.5,
        refreshIntervalMinutes: 15,
      })
    ).toEqual(new Date("2026-07-13T14:00:00.000Z"))
  })

  it("clamps invalid worker settings", () => {
    expect(
      readClampedPositiveInteger({
        fallback: 100,
        maximum: 1_000,
        minimum: 1,
        value: "not-a-number",
      })
    ).toBe(100)
    expect(
      readClampedPositiveInteger({
        fallback: 100,
        maximum: 1_000,
        minimum: 1,
        value: "5000",
      })
    ).toBe(1_000)
  })
})

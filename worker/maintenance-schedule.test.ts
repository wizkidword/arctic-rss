import { describe, expect, it } from "vitest"

import { MaintenanceSchedule } from "./maintenance-schedule"

describe("maintenance schedule", () => {
  it("tracks the last success separately from the next normal attempt", () => {
    const schedule = new MaintenanceSchedule({ normalIntervalMs: 60_000 })

    expect(schedule.isDue(1_000)).toBe(true)
    expect(schedule.recordSuccess(1_000)).toEqual({
      failureCount: 0,
      lastSuccessAgeMs: 0,
      nextEligibleAt: 61_000,
    })
    expect(schedule.snapshot(31_000)).toEqual({
      failureCount: 0,
      lastSuccessAgeMs: 30_000,
      nextEligibleAt: 61_000,
    })
    expect(schedule.isDue(60_999)).toBe(false)
    expect(schedule.isDue(61_000)).toBe(true)
  })

  it("uses bounded exponential retries without changing the last successful time", () => {
    const schedule = new MaintenanceSchedule({
      normalIntervalMs: 6 * 60 * 60_000,
      retryBaseMs: 60_000,
      retryMaxMs: 4 * 60_000,
    })

    schedule.recordSuccess(0)
    expect(schedule.recordFailure(1_000)).toEqual({
      failureCount: 1,
      lastSuccessAgeMs: 1_000,
      nextEligibleAt: 61_000,
    })
    expect(schedule.recordFailure(61_000)).toEqual({
      failureCount: 2,
      lastSuccessAgeMs: 61_000,
      nextEligibleAt: 181_000,
    })
    expect(schedule.recordFailure(181_000)).toEqual({
      failureCount: 3,
      lastSuccessAgeMs: 181_000,
      nextEligibleAt: 421_000,
    })
    expect(schedule.recordFailure(421_000)).toEqual({
      failureCount: 4,
      lastSuccessAgeMs: 421_000,
      nextEligibleAt: 661_000,
    })
    expect(schedule.recordFailure(661_000)).toEqual({
      failureCount: 5,
      lastSuccessAgeMs: 661_000,
      nextEligibleAt: 901_000,
    })
  })

  it("resets failure state only after a successful maintenance pass", () => {
    const schedule = new MaintenanceSchedule({
      normalIntervalMs: 60_000,
      retryBaseMs: 10_000,
    })

    schedule.recordFailure(0)
    schedule.recordFailure(10_000)
    expect(schedule.recordDeferred(30_000)).toEqual({
      failureCount: 2,
      lastSuccessAgeMs: null,
      nextEligibleAt: 90_000,
    })
    expect(schedule.recordSuccess(90_000)).toEqual({
      failureCount: 0,
      lastSuccessAgeMs: 0,
      nextEligibleAt: 150_000,
    })
  })
})

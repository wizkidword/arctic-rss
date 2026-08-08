import { afterEach, describe, expect, it, vi } from "vitest"

import {
  PUBLIC_HEALTH_CACHE_MS,
  PUBLIC_HEALTH_MAX_STALE_MS,
  readPublicHealthSnapshot,
  refreshDetailedHealthSnapshot,
  resetHealthSnapshotForTests,
} from "./health-snapshot"

const healthyResult = {
  checks: {
    chatGateway: "disabled" as const,
    database: "ok" as const,
    durableRedis: "ok" as const,
    ephemeralRedis: "ok" as const,
    maintenance: "ok" as const,
    queues: "ok" as const,
    workers: { all: "ok" as const },
  },
  status: "ok" as const,
}

afterEach(() => {
  resetHealthSnapshotForTests()
})

describe("health snapshots", () => {
  it("shares one initial refresh across one hundred concurrent public requests", async () => {
    let resolveCheck: ((value: typeof healthyResult) => void) | undefined
    const check = vi.fn(
      () => new Promise<typeof healthyResult>((resolve) => {
        resolveCheck = resolve
      })
    )
    const reads = Array.from({ length: 100 }, () =>
      readPublicHealthSnapshot({ check, now: () => 10_000 })
    )

    expect(check).toHaveBeenCalledOnce()
    resolveCheck?.(healthyResult)

    await expect(Promise.all(reads)).resolves.toEqual(
      Array.from({ length: 100 }, () => ({
        snapshot: {
          checkedAt: 10_000,
          durationMs: 0,
          result: healthyResult,
          status: "ok",
        },
        source: "miss",
      }))
    )
  })

  it("returns a fresh snapshot without another dependency check inside the cache window", async () => {
    const check = vi.fn().mockResolvedValue(healthyResult)

    await readPublicHealthSnapshot({ check, now: () => 10_000 })
    const next = await readPublicHealthSnapshot({
      check,
      now: () => 10_000 + PUBLIC_HEALTH_CACHE_MS,
    })

    expect(check).toHaveBeenCalledOnce()
    expect(next.source).toBe("fresh")
  })

  it("serves the last completed status while one expired refresh is in flight", async () => {
    const initialCheck = vi.fn().mockResolvedValue(healthyResult)
    await readPublicHealthSnapshot({ check: initialCheck, now: () => 10_000 })

    let resolveRefresh: ((value: typeof healthyResult) => void) | undefined
    const check = vi.fn(
      () => new Promise<typeof healthyResult>((resolve) => {
        resolveRefresh = resolve
      })
    )
    const stale = await readPublicHealthSnapshot({
      check,
      now: () => 10_000 + PUBLIC_HEALTH_CACHE_MS + 1,
    })

    expect(stale.source).toBe("stale")
    expect(stale.snapshot.status).toBe("ok")
    expect(check).toHaveBeenCalledOnce()
    resolveRefresh?.(healthyResult)
  })

  it("waits for a new result after the maximum stale age", async () => {
    const initialCheck = vi.fn().mockResolvedValue(healthyResult)
    await readPublicHealthSnapshot({ check: initialCheck, now: () => 10_000 })
    const unavailable = vi.fn().mockRejectedValue(new Error("dependency unavailable"))

    const next = await readPublicHealthSnapshot({
      check: unavailable,
      now: () => 10_000 + PUBLIC_HEALTH_MAX_STALE_MS + 1,
    })

    expect(next).toMatchObject({ source: "miss", snapshot: { status: "unavailable" } })
    expect(unavailable).toHaveBeenCalledOnce()
  })

  it("shares an explicit detailed refresh with an existing request", async () => {
    let resolveCheck: ((value: typeof healthyResult) => void) | undefined
    const check = vi.fn(
      () => new Promise<typeof healthyResult>((resolve) => {
        resolveCheck = resolve
      })
    )
    const detailed = refreshDetailedHealthSnapshot({ check, now: () => 10_000 })
    const publicRead = readPublicHealthSnapshot({ check, now: () => 10_000 })

    expect(check).toHaveBeenCalledOnce()
    resolveCheck?.(healthyResult)

    await expect(detailed).resolves.toMatchObject({ status: "ok" })
    await expect(publicRead).resolves.toMatchObject({ snapshot: { status: "ok" } })
  })
})

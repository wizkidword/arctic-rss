import { describe, expect, it, vi } from "vitest"

import {
  createHealthSnapshot,
  HEALTH_SNAPSHOT_KEY,
  HEALTH_SNAPSHOT_MAX_AGE_MS,
  HEALTH_SNAPSHOT_TTL_MS,
  readPublicHealthSnapshot,
  writeHealthSnapshot,
} from "./health-snapshot"

const checkedAt = 1_752_428_800_000
const healthyResult = {
  checks: {
    chatGateway: "disabled" as const,
    database: "ok" as const,
    durableRedis: "ok" as const,
    ephemeralRedis: "ok" as const,
    maintenance: "ok" as const,
    queues: "ok" as const,
    workers: { all: "ok" as const, health: "ok" as const },
  },
  status: "ok" as const,
}

describe("health snapshots", () => {
  it("writes a compact, versioned snapshot with a durable Redis TTL", async () => {
    const store = { set: vi.fn().mockResolvedValue("OK") }

    const snapshot = await writeHealthSnapshot({
      checkedAt,
      result: healthyResult,
      store,
      topology: "all-in-one",
    })

    expect(snapshot).toEqual({
      checkedAt: new Date(checkedAt).toISOString(),
      checks: {
        chatGateway: "disabled",
        database: "ok",
        durableRedis: "ok",
        ephemeralRedis: "ok",
        maintenance: "ok",
        queues: "ok",
        workers: "ok",
      },
      expiresAt: new Date(checkedAt + HEALTH_SNAPSHOT_TTL_MS).toISOString(),
      status: "ok",
      topology: "all-in-one",
      version: 1,
    })
    expect(store.set).toHaveBeenCalledWith(
      HEALTH_SNAPSHOT_KEY,
      JSON.stringify(snapshot),
      "PX",
      HEALTH_SNAPSHOT_TTL_MS
    )
  })

  it("serves a fresh shared snapshot without invoking dependency diagnostics", async () => {
    const snapshot = createHealthSnapshot({
      checkedAt,
      result: healthyResult,
      topology: "split",
    })
    const store = { get: vi.fn().mockResolvedValue(JSON.stringify(snapshot)) }

    await expect(
      readPublicHealthSnapshot({ store, now: () => checkedAt + 1_000 })
    ).resolves.toEqual({
      snapshot,
      snapshotAgeMs: 1_000,
      source: "fresh",
      status: "ok",
    })
  })

  it("marks a missing, malformed, or stale snapshot degraded", async () => {
    const stale = createHealthSnapshot({
      checkedAt,
      result: healthyResult,
      topology: "split",
    })

    await expect(
      readPublicHealthSnapshot({ store: { get: vi.fn().mockResolvedValue(null) } })
    ).resolves.toMatchObject({ source: "missing", status: "degraded" })
    await expect(
      readPublicHealthSnapshot({ store: { get: vi.fn().mockResolvedValue("not-json") } })
    ).resolves.toMatchObject({ source: "missing", status: "degraded" })
    await expect(
      readPublicHealthSnapshot({
        now: () => checkedAt + HEALTH_SNAPSHOT_MAX_AGE_MS + 1,
        store: { get: vi.fn().mockResolvedValue(JSON.stringify(stale)) },
      })
    ).resolves.toMatchObject({ source: "stale", status: "degraded" })
  })

  it("returns degraded when the bounded Redis read does not complete", async () => {
    await expect(
      readPublicHealthSnapshot({
        readTimeoutMs: 1,
        store: { get: vi.fn(() => new Promise<string | null>(() => undefined)) },
      })
    ).resolves.toMatchObject({ source: "unavailable", status: "degraded" })
  })

  it("keeps one thousand public reads to snapshot GET work only", async () => {
    const snapshot = createHealthSnapshot({
      checkedAt,
      result: healthyResult,
      topology: "all-in-one",
    })
    const store = { get: vi.fn().mockResolvedValue(JSON.stringify(snapshot)) }

    const results = await Promise.all(
      Array.from({ length: 1_000 }, () =>
        readPublicHealthSnapshot({ store, now: () => checkedAt + 1_000 })
      )
    )

    expect(store.get).toHaveBeenCalledTimes(1_000)
    expect(results.every((result) => result.status === "ok")).toBe(true)
  })
})

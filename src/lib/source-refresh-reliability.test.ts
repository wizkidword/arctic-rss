import { describe, expect, it, vi } from "vitest"

import { SOURCE_REFRESH_FAILURE_REDIS_KEY } from "./source-refresh-failures"
import { inspectSourceRefreshReliabilityWithStore } from "./source-refresh-reliability"

const now = 1_752_428_800_000

function event(value: Record<string, unknown>) {
  return JSON.stringify({ timestamp: now, ...value })
}

describe("source refresh reliability", () => {
  it("reports publisher failures without treating them as a shared platform incident", async () => {
    const store = {
      lrange: vi.fn().mockResolvedValue([
        event({
          errorCategory: "http_5xx",
          host: "publisher.example",
          kind: "feed",
          outcome: "failed",
        }),
        event({ kind: "feed", outcome: "succeeded" }),
      ]),
    }

    await expect(
      inspectSourceRefreshReliabilityWithStore({ now, store }),
    ).resolves.toEqual({
      affectedHosts: ["publisher.example"],
      available: true,
      errorCategories: { http_5xx: 1 },
      failureCount: 1,
      failurePercentage: 50,
      feedFailureCount: 1,
      podcastFailureCount: 0,
      platformImpact: "none",
      recentAttemptCount: 2,
      recurringFailureHosts: [],
      status: "degraded",
    })
    expect(store.lrange).toHaveBeenCalledWith(
      SOURCE_REFRESH_FAILURE_REDIS_KEY,
      0,
      99,
    )
  })

  it("flags a diverse, high-percentage shared database failure", async () => {
    const store = {
      lrange: vi.fn().mockResolvedValue([
        event({
          errorCategory: "database",
          host: "one.example",
          kind: "feed",
          outcome: "failed",
        }),
        event({
          errorCategory: "database",
          host: "two.example",
          kind: "podcast",
          outcome: "failed",
        }),
      ]),
    }

    const result = await inspectSourceRefreshReliabilityWithStore({
      now,
      store,
    })

    expect(result).toMatchObject({
      errorCategories: { database: 2 },
      failurePercentage: 100,
      platformImpact: "degraded",
      status: "degraded",
    })
  })

  it("does not classify an absolute count alone as a shared incident", async () => {
    const store = {
      lrange: vi.fn().mockResolvedValue(
        Array.from({ length: 3 }, () =>
          event({
            errorCategory: "timeout",
            host: "one.example",
            kind: "feed",
            outcome: "failed",
          }),
        ),
      ),
    }

    const result = await inspectSourceRefreshReliabilityWithStore({
      now,
      store,
    })

    expect(result).toMatchObject({
      platformImpact: "none",
      recurringFailureHosts: ["one.example"],
    })
  })
})

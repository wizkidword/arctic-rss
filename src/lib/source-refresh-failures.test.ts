import { describe, expect, it, vi } from "vitest"

import {
  countRecentSourceRefreshFailures,
  MAX_RETAINED_SOURCE_REFRESH_FAILURES,
  recordSourceRefreshFailure,
  SOURCE_REFRESH_FAILURE_REDIS_KEY,
} from "./source-refresh-failures"

describe("source refresh failure evidence", () => {
  it("records bounded, source-id-free failure evidence", async () => {
    const client = {
      lpush: vi.fn().mockResolvedValue(1),
      ltrim: vi.fn().mockResolvedValue("OK"),
    }

    await recordSourceRefreshFailure({
      client,
      kind: "feed",
      timestamp: 1_752_428_800_123,
    })

    expect(client.lpush).toHaveBeenCalledWith(
      SOURCE_REFRESH_FAILURE_REDIS_KEY,
      JSON.stringify({
        kind: "feed",
        outcome: "failed",
        timestamp: 1_752_428_800_123,
      })
    )
    expect(client.ltrim).toHaveBeenCalledWith(
      SOURCE_REFRESH_FAILURE_REDIS_KEY,
      0,
      MAX_RETAINED_SOURCE_REFRESH_FAILURES - 1
    )
  })

  it("counts only valid events inside the readiness window", async () => {
    const client = {
      lrange: vi
        .fn()
        .mockResolvedValue([
          JSON.stringify({ kind: "feed", timestamp: 10_000 }),
          JSON.stringify({ kind: "podcast", timestamp: 4_999 }),
          JSON.stringify({ kind: "other", timestamp: 10_000 }),
          "not-json",
        ]),
    }

    await expect(
      countRecentSourceRefreshFailures({
        client,
        now: 10_000,
        windowMs: 5_000,
      })
    ).resolves.toBe(1)
  })
})

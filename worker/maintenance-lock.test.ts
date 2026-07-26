import { describe, expect, it, vi } from "vitest"

import { createMaintenanceLock } from "./maintenance-lock"

function client(setResult: "OK" | null) {
  return {
    disconnect: vi.fn(),
    eval: vi.fn().mockResolvedValue(1),
    quit: vi.fn().mockResolvedValue("OK"),
    set: vi.fn().mockResolvedValue(setResult),
  }
}

describe("maintenance lock", () => {
  it("runs maintenance only while it owns the durable Redis lease", async () => {
    const redis = client("OK")
    const lock = createMaintenanceLock({ client: redis, token: "owner" })
    const operation = vi.fn().mockResolvedValue("done")

    await expect(lock.run(operation)).resolves.toEqual({
      acquired: true,
      value: "done",
    })
    expect(operation).toHaveBeenCalledOnce()
    expect(redis.set).toHaveBeenCalledWith(
      "arctic-rss:worker:maintenance-lock:v1",
      "owner",
      "PX",
      300_000,
      "NX"
    )
    expect(redis.eval).toHaveBeenCalledOnce()
  })

  it("skips maintenance safely when another process owns the lease", async () => {
    const redis = client(null)
    const lock = createMaintenanceLock({ client: redis })
    const operation = vi.fn()

    await expect(lock.run(operation)).resolves.toEqual({ acquired: false })
    expect(operation).not.toHaveBeenCalled()
  })
})

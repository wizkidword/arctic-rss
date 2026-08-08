import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const health = vi.hoisted(() => ({
  writeDurableWorkerHeartbeat: vi.fn(),
  writeWorkerHeartbeat: vi.fn(),
}))

vi.mock("../src/lib/worker-health", () => health)

import { startWorkerHeartbeat } from "./heartbeat"

describe("worker heartbeat", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    health.writeDurableWorkerHeartbeat.mockResolvedValue(undefined)
    health.writeWorkerHeartbeat.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it("records immediately, repeats on schedule, and stops cleanly", async () => {
    const heartbeat = startWorkerHeartbeat({
      instanceId: "worker-1",
      intervalMs: 1_000,
      mode: "ingestion",
      path: "/tmp/worker-heartbeat",
      store: {} as never,
      version: "test-version",
    })

    expect(health.writeWorkerHeartbeat).toHaveBeenCalledWith({ path: "/tmp/worker-heartbeat" })
    expect(health.writeDurableWorkerHeartbeat).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: "worker-1",
        mode: "ingestion",
        version: "test-version",
      })
    )

    await vi.advanceTimersByTimeAsync(1_000)
    expect(health.writeWorkerHeartbeat).toHaveBeenCalledTimes(2)
    expect(health.writeDurableWorkerHeartbeat).toHaveBeenCalledTimes(2)

    heartbeat.stop()
    await vi.advanceTimersByTimeAsync(2_000)
    expect(health.writeWorkerHeartbeat).toHaveBeenCalledTimes(2)
    expect(health.writeDurableWorkerHeartbeat).toHaveBeenCalledTimes(2)
  })
})

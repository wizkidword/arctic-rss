import { EventEmitter } from "node:events"

import { describe, expect, it, vi } from "vitest"

import {
  getWorkerShutdownTimeoutMs,
  installWorkerSignalHandlers,
  shutdownWorkerRuntime,
} from "./shutdown"

describe("worker shutdown", () => {
  it("drains an active bulk-read job when SIGTERM arrives", async () => {
    const signals = new EventEmitter()
    const activeJobs = new Set(["bulk-read-42"])
    const close = vi.fn(async (force?: boolean) => {
      expect(force).toBeUndefined()
    })
    const pause = vi.fn(async (doNotWaitActive?: boolean) => {
      expect(doNotWaitActive).toBe(true)
    })
    const closeResources = vi.fn().mockResolvedValue(undefined)
    const disconnectDatabase = vi.fn().mockResolvedValue(undefined)
    const exit = vi.fn()
    const logs: Array<Record<string, unknown>> = []
    const shutdown = () =>
      shutdownWorkerRuntime({
        closeResources,
        disconnectDatabase,
        log: (entry) => logs.push(entry),
        stopScheduling: vi.fn(),
        timeoutMs: 1_000,
        waitIntervalMs: 1,
        workers: [
          {
            activeJobs: () => [...activeJobs],
            name: "bulk-read",
            worker: { close, pause },
          },
        ],
      })
    const removeHandlers = installWorkerSignalHandlers({
      exit,
      shutdown,
      signalSource: signals as never,
    })

    signals.emit("SIGTERM")
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(close).not.toHaveBeenCalled()

    activeJobs.clear()
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0))

    expect(pause).toHaveBeenCalledWith(true)
    expect(close).toHaveBeenCalledWith()
    expect(closeResources).toHaveBeenCalledOnce()
    expect(disconnectDatabase).toHaveBeenCalledOnce()
    expect(logs).toContainEqual(
      expect.objectContaining({ event: "worker_shutdown", outcome: "complete" })
    )
    removeHandlers()
  })

  it("force-closes resumable work when the grace period expires", async () => {
    const close = vi.fn().mockResolvedValue(undefined)

    await expect(
      shutdownWorkerRuntime({
        closeResources: vi.fn().mockResolvedValue(undefined),
        disconnectDatabase: vi.fn().mockResolvedValue(undefined),
        stopScheduling: vi.fn(),
        timeoutMs: 1_000,
        waitIntervalMs: 1,
        workers: [
          {
            activeJobs: () => ["bulk-read-42"],
            name: "bulk-read",
            worker: { close, pause: vi.fn().mockResolvedValue(undefined) },
          },
        ],
      })
    ).resolves.toMatchObject({
      forced: true,
      remainingActiveJobs: ["bulk-read:bulk-read-42"],
    })

    expect(close).toHaveBeenCalledWith(true)
  })

  it("uses a bounded graceful-shutdown timeout", () => {
    expect(
      getWorkerShutdownTimeoutMs({ WORKER_GRACEFUL_SHUTDOWN_TIMEOUT_MS: "900" })
    ).toBe(30_000)
    expect(
      getWorkerShutdownTimeoutMs({ WORKER_GRACEFUL_SHUTDOWN_TIMEOUT_MS: "45000" })
    ).toBe(45_000)
  })
})

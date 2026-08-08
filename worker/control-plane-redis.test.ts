import { describe, expect, it, vi } from "vitest"

import {
  createWorkerControlPlaneRedis,
  getWorkerControlPlaneRecoveryGraceMs,
  workerControlPlaneReconnectDelay,
} from "./control-plane-redis"

function fakeClient() {
  const handlers = new Map<string, Array<() => void>>()

  return {
    disconnect: vi.fn(),
    emit(event: string) {
      for (const handler of handlers.get(event) ?? []) {
        handler()
      }
    },
    on: vi.fn((event: string, handler: () => void) => {
      handlers.set(event, [...(handlers.get(event) ?? []), handler])
    }),
    quit: vi.fn().mockResolvedValue("OK"),
  }
}

function manualTimer() {
  let callback: (() => void) | undefined

  return {
    clearTimeout: vi.fn(),
    run() {
      callback?.()
    },
    setTimeout: vi.fn((next: () => void) => {
      callback = next
      return {} as ReturnType<typeof setTimeout>
    }),
  }
}

describe("worker control-plane Redis", () => {
  it("uses bounded exponential reconnect delays with jitter", () => {
    expect(workerControlPlaneReconnectDelay(1, () => 0)).toBe(80)
    expect(workerControlPlaneReconnectDelay(1, () => 1)).toBe(120)
    expect(workerControlPlaneReconnectDelay(3, () => 0.5)).toBe(400)
    expect(workerControlPlaneReconnectDelay(100, () => 1)).toBe(5_000)
  })

  it("bounds the configurable recovery grace period", () => {
    expect(
      getWorkerControlPlaneRecoveryGraceMs({ WORKER_CONTROL_PLANE_RECOVERY_GRACE_MS: "10000" })
    ).toBe(10_000)
    expect(
      getWorkerControlPlaneRecoveryGraceMs({ WORKER_CONTROL_PLANE_RECOVERY_GRACE_MS: "9999" })
    ).toBe(60_000)
    expect(
      getWorkerControlPlaneRecoveryGraceMs({ WORKER_CONTROL_PLANE_RECOVERY_GRACE_MS: "600001" })
    ).toBe(60_000)
  })

  it("becomes unavailable immediately, recovers on ready, and logs state changes once", () => {
    const client = fakeClient()
    const timer = manualTimer()
    const logs: Array<Record<string, unknown>> = []
    const control = createWorkerControlPlaneRedis({
      client,
      log: (entry) => logs.push(entry),
      timer,
    })

    client.emit("ready")
    expect(control.isReady()).toBe(true)
    client.emit("close")
    client.emit("close")
    expect(control.isReady()).toBe(false)
    client.emit("reconnecting")
    client.emit("ready")

    expect(control.isReady()).toBe(true)
    expect(logs.map((entry) => entry.state)).toEqual([
      "ready",
      "unavailable",
      "reconnecting",
      "ready",
    ])
    expect(timer.setTimeout).toHaveBeenCalledOnce()
    expect(timer.clearTimeout).toHaveBeenCalledOnce()
  })

  it("requests a nonzero-restart path only after the bounded recovery grace", () => {
    const client = fakeClient()
    const timer = manualTimer()
    const expired = vi.fn()
    const control = createWorkerControlPlaneRedis({
      client,
      graceMs: 10_000,
      onGraceExpired: expired,
      timer,
    })

    client.emit("ready")
    client.emit("close")
    expect(control.isReady()).toBe(false)
    expect(expired).not.toHaveBeenCalled()
    timer.run()
    expect(expired).toHaveBeenCalledOnce()
  })

  it("stops recovery and prevents a grace failure during intentional shutdown", async () => {
    const client = fakeClient()
    const timer = manualTimer()
    const expired = vi.fn()
    const control = createWorkerControlPlaneRedis({
      client,
      onGraceExpired: expired,
      timer,
    })

    client.emit("close")
    await control.close()
    timer.run()

    expect(client.quit).toHaveBeenCalledOnce()
    expect(control.isReady()).toBe(false)
    expect(expired).not.toHaveBeenCalled()
  })
})

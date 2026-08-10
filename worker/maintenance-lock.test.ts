import { describe, expect, it, vi } from "vitest"

import {
  createMaintenanceLock,
  MaintenanceLeaseLostError,
} from "./maintenance-lock"

type ManualTimer = ReturnType<typeof manualTimer>

function client(setResult: "OK" | null) {
  return {
    disconnect: vi.fn(),
    eval: vi.fn().mockResolvedValue(1),
    quit: vi.fn().mockResolvedValue("OK"),
    set: vi.fn().mockResolvedValue(setResult),
  }
}

function manualTimer() {
  let callback: (() => void) | undefined

  return {
    clearInterval: vi.fn(),
    setInterval: vi.fn((next: () => void) => {
      callback = next
      return {} as ReturnType<typeof setInterval>
    }),
    async tick() {
      callback?.()
      await flushPromises()
    },
  }
}

function sharedRedis(clock: { now: number }) {
  const leases = new Map<string, { expiresAt: number; owner: string }>()

  const currentOwner = (key: string) => {
    const lease = leases.get(key)
    if (lease && lease.expiresAt <= clock.now) {
      leases.delete(key)
    }
    return leases.get(key)?.owner
  }

  return {
    disconnect: vi.fn(),
    eval: vi.fn(
      async (
        script: string,
        _keyCount: number,
        key: string,
        token: string,
        ...arguments_: string[]
      ) => {
        if (currentOwner(key) !== token) {
          return 0
        }

        if (script.includes("pexpire")) {
          leases.set(key, {
            expiresAt: clock.now + Number(arguments_[0]),
            owner: token,
          })
          return 1
        }

        leases.delete(key)
        return 1
      }
    ),
    owner: (key = "arctic-rss:worker:maintenance-lock:v1") => currentOwner(key),
    quit: vi.fn().mockResolvedValue("OK"),
    set: vi.fn(
      async (key: string, token: string, _mode: string, ttl: number) => {
        if (currentOwner(key)) {
          return null
        }

        leases.set(key, { expiresAt: clock.now + ttl, owner: token })
        return "OK"
      }
    ),
  }
}

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((next) => {
    resolve = next
  })

  return { promise, resolve }
}

async function flushPromises() {
  await Promise.resolve()
  await Promise.resolve()
}

async function waitForLease(timer: ManualTimer) {
  await vi.waitFor(() => expect(timer.setInterval).toHaveBeenCalledOnce())
}

describe("maintenance lock", () => {
  it("runs maintenance only while it owns the durable Redis lease", async () => {
    const redis = client("OK")
    const lock = createMaintenanceLock({
      client: redis,
      tokenFactory: () => "owner",
    })
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

  it("renews a pass that outlives its initial TTL and continues to exclude a second worker", async () => {
    const clock = { now: 0 }
    const redis = sharedRedis(clock)
    const firstTimer = manualTimer()
    const firstGate = deferred<string>()
    const first = createMaintenanceLock({
      client: redis,
      now: () => clock.now,
      renewIntervalMs: 10,
      timer: firstTimer,
      tokenFactory: () => "first-owner",
      ttlMs: 30,
    })
    const second = createMaintenanceLock({
      client: redis,
      now: () => clock.now,
      tokenFactory: () => "second-owner",
      ttlMs: 30,
    })

    const running = first.run(async () => firstGate.promise)
    await waitForLease(firstTimer)

    clock.now = 10
    await firstTimer.tick()
    clock.now = 35

    await expect(second.run(async () => "overlap")).resolves.toEqual({
      acquired: false,
    })
    expect(redis.owner()).toBe("first-owner")

    firstGate.resolve("done")
    await expect(running).resolves.toEqual({ acquired: true, value: "done" })
  })

  it("does not let maintenance lock contention suppress the health snapshot lease", async () => {
    const clock = { now: 0 }
    const redis = sharedRedis(clock)
    const maintenanceTimer = manualTimer()
    const maintenanceGate = deferred<string>()
    const maintenance = createMaintenanceLock({
      client: redis,
      now: () => clock.now,
      timer: maintenanceTimer,
      tokenFactory: () => "maintenance-owner",
    })
    const healthSnapshot = createMaintenanceLock({
      client: redis,
      key: "arctic-rss:worker:health-snapshot-lock:v1",
      name: "health_snapshot",
      now: () => clock.now,
      tokenFactory: () => "health-owner",
    })

    const runningMaintenance = maintenance.run(
      async () => maintenanceGate.promise
    )
    await waitForLease(maintenanceTimer)

    await expect(healthSnapshot.run(async () => "snapshot")).resolves.toEqual({
      acquired: true,
      value: "snapshot",
    })
    expect(redis.owner()).toBe("maintenance-owner")
    expect(
      redis.owner("arctic-rss:worker:health-snapshot-lock:v1")
    ).toBeUndefined()

    maintenanceGate.resolve("done")
    await expect(runningMaintenance).resolves.toEqual({
      acquired: true,
      value: "done",
    })
  })

  it("marks the lease lost and safely cancels the pass when Redis renewal is interrupted", async () => {
    const redis = client("OK")
    redis.eval.mockImplementation((script: string) => {
      if (script.includes("pexpire")) {
        return Promise.reject(new Error("redis unavailable"))
      }
      return Promise.resolve(1)
    })
    const timer = manualTimer()
    const gate = deferred()
    const logs: Array<Record<string, unknown>> = []
    const lock = createMaintenanceLock({
      client: redis,
      log: (entry) => logs.push(entry),
      renewIntervalMs: 10,
      timer,
      tokenFactory: () => "owner",
      ttlMs: 30,
    })

    const running = lock.run(async (lease) => {
      await gate.promise
      lease.assertHeld()
      return "done"
    })
    await waitForLease(timer)

    await timer.tick()
    gate.resolve()

    await expect(running).rejects.toMatchObject({
      name: "MaintenanceLeaseLostError",
      reason: "renewal_error",
    } satisfies Partial<MaintenanceLeaseLostError>)
    expect(logs).toContainEqual(
      expect.objectContaining({
        event: "worker_maintenance_lease",
        outcome: "lost",
        reason: "renewal_error",
      })
    )
  })

  it("cannot release a newer owner's lease after its original lease expires", async () => {
    const clock = { now: 0 }
    const redis = sharedRedis(clock)
    const oldTimer = manualTimer()
    const oldGate = deferred()
    const newGate = deferred()
    const oldLock = createMaintenanceLock({
      client: redis,
      now: () => clock.now,
      renewIntervalMs: 10,
      timer: oldTimer,
      tokenFactory: () => "old-owner",
      ttlMs: 30,
    })
    const newLock = createMaintenanceLock({
      client: redis,
      now: () => clock.now,
      tokenFactory: () => "new-owner",
      ttlMs: 30,
    })

    const oldRun = oldLock.run(async (lease) => {
      await oldGate.promise
      lease.assertHeld()
    })
    await waitForLease(oldTimer)
    clock.now = 31

    const newRun = newLock.run(async () => newGate.promise)
    await flushPromises()
    expect(redis.owner()).toBe("new-owner")

    await oldLock.close()
    expect(redis.owner()).toBe("new-owner")

    oldGate.resolve()
    await expect(oldRun).rejects.toMatchObject({ reason: "shutdown" })
    newGate.resolve()
    await expect(newRun).resolves.toEqual({ acquired: true, value: undefined })
  })

  it("releases its lease and closes Redis during shutdown", async () => {
    const redis = client("OK")
    const timer = manualTimer()
    const gate = deferred()
    const lock = createMaintenanceLock({
      client: redis,
      timer,
      tokenFactory: () => "owner",
    })

    const running = lock.run(async (lease) => {
      await gate.promise
      lease.assertHeld()
    })
    await waitForLease(timer)

    await lock.close()
    expect(redis.eval).toHaveBeenCalledOnce()
    expect(redis.quit).toHaveBeenCalledOnce()

    gate.resolve()
    await expect(running).rejects.toMatchObject({ reason: "shutdown" })
  })

  it("allows exactly one of racing workers to acquire the shared lease", async () => {
    const clock = { now: 0 }
    const redis = sharedRedis(clock)
    const first = createMaintenanceLock({
      client: redis,
      now: () => clock.now,
      tokenFactory: () => "first-owner",
      ttlMs: 30,
    })
    const second = createMaintenanceLock({
      client: redis,
      now: () => clock.now,
      tokenFactory: () => "second-owner",
      ttlMs: 30,
    })

    const results = await Promise.all([
      first.run(async () => "first"),
      second.run(async () => "second"),
    ])

    expect(results.filter((result) => result.acquired)).toHaveLength(1)
    expect(results.filter((result) => !result.acquired)).toHaveLength(1)
  })

  it("skips maintenance safely when another process owns the lease", async () => {
    const redis = client(null)
    const lock = createMaintenanceLock({ client: redis })
    const operation = vi.fn()

    await expect(lock.run(operation)).resolves.toEqual({ acquired: false })
    expect(operation).not.toHaveBeenCalled()
  })

  it("waits for a ready control plane and abandons an acquisition that loses readiness", async () => {
    const redis = client("OK")
    let ready = false
    const lock = createMaintenanceLock({
      client: redis,
      isReady: () => ready,
      tokenFactory: () => "owner",
    })

    await expect(lock.run(async () => "too early")).resolves.toEqual({
      acquired: false,
    })
    expect(redis.set).not.toHaveBeenCalled()

    ready = true
    redis.set.mockImplementationOnce(async () => {
      ready = false
      return "OK"
    })
    const operation = vi.fn()

    await expect(lock.run(operation)).rejects.toMatchObject({
      reason: "connection_lost",
    })
    expect(operation).not.toHaveBeenCalled()
    expect(redis.eval).not.toHaveBeenCalled()
  })

  it("permits a later maintenance tick after Redis recovery without duplicate ownership", async () => {
    const redis = client("OK")
    let ready = false
    const lock = createMaintenanceLock({ client: redis, isReady: () => ready })

    await expect(lock.run(async () => "first")).resolves.toEqual({
      acquired: false,
    })

    ready = true
    await expect(lock.run(async () => "recovered")).resolves.toEqual({
      acquired: true,
      value: "recovered",
    })
    expect(redis.set).toHaveBeenCalledOnce()
  })
})

import { describe, expect, it, vi } from "vitest"

import { createMaintenanceLock, MaintenanceLeaseLostError } from "./maintenance-lock"

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
  let expiresAt = 0
  let owner: string | undefined

  const currentOwner = () => {
    if (owner && expiresAt <= clock.now) {
      owner = undefined
    }
    return owner
  }

  return {
    disconnect: vi.fn(),
    eval: vi.fn(async (
      script: string,
      _keyCount: number,
      _key: string,
      token: string,
      ...arguments_: string[]
    ) => {
      if (currentOwner() !== token) {
        return 0
      }

      if (script.includes("pexpire")) {
        expiresAt = clock.now + Number(arguments_[0])
        return 1
      }

      owner = undefined
      return 1
    }),
    owner: () => currentOwner(),
    quit: vi.fn().mockResolvedValue("OK"),
    set: vi.fn(async (_key: string, token: string, _mode: string, ttl: number) => {
      if (currentOwner()) {
        return null
      }

      owner = token
      expiresAt = clock.now + ttl
      return "OK"
    }),
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

    await expect(second.run(async () => "overlap")).resolves.toEqual({ acquired: false })
    expect(redis.owner()).toBe("first-owner")

    firstGate.resolve("done")
    await expect(running).resolves.toEqual({ acquired: true, value: "done" })
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
})

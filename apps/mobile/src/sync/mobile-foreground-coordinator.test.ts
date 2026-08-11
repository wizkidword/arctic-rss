import { describe, expect, it, vi } from "vitest"

import { MobileApiError, MobileNetworkError } from "@arctic-rss/mobile-client"

import { MobileForegroundCoordinator } from "./mobile-foreground-coordinator"

function deferred() {
  let resolve: (() => void) | undefined
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve: () => resolve?.() }
}

describe("mobile foreground coordinator", () => {
  it("serializes overlapping triggers and runs one requested follow-up pass", async () => {
    const firstFlush = deferred()
    const claimOwner = vi.fn().mockResolvedValue(undefined)
    const flush = vi
      .fn()
      .mockImplementationOnce(() => firstFlush.promise.then(() => ({ conflicts: 0 })))
      .mockResolvedValue({ conflicts: 0 })
    const sync = vi.fn().mockResolvedValue({})
    const coordinator = new MobileForegroundCoordinator({ claimOwner, flush, sync })

    const initial = coordinator.request()
    const foreground = coordinator.request({ returnSession: true })
    await Promise.resolve()
    expect(flush).toHaveBeenCalledOnce()
    firstFlush.resolve()

    await expect(Promise.all([initial, foreground])).resolves.toEqual([undefined, undefined])
    expect(claimOwner).toHaveBeenCalledTimes(2)
    expect(flush).toHaveBeenCalledTimes(2)
    expect(sync).toHaveBeenNthCalledWith(1, { returnSession: false })
    expect(sync).toHaveBeenNthCalledWith(2, { returnSession: true })
    expect(coordinator.snapshot()).toMatchObject({ state: "idle" })
  })

  it("surfaces retryable failures as offline without clearing the owner", async () => {
    const coordinator = new MobileForegroundCoordinator({
      claimOwner: vi.fn().mockResolvedValue(undefined),
      flush: vi.fn().mockRejectedValue(new MobileNetworkError()),
      sync: vi.fn(),
    })

    await expect(coordinator.request()).rejects.toBeInstanceOf(MobileNetworkError)
    expect(coordinator.snapshot()).toMatchObject({ state: "offline" })
  })

  it("surfaces an exhausted authenticated request as auth required", async () => {
    const coordinator = new MobileForegroundCoordinator({
      claimOwner: vi.fn().mockResolvedValue(undefined),
      flush: vi.fn().mockRejectedValue(
        new MobileApiError("MOBILE_DEVICE_SESSION_REQUIRED", "Sign in", false, 401)
      ),
      sync: vi.fn(),
    })

    await expect(coordinator.request()).rejects.toBeInstanceOf(MobileApiError)
    expect(coordinator.snapshot()).toMatchObject({ state: "auth-required" })
  })
})

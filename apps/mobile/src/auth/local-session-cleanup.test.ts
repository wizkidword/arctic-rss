import { describe, expect, it, vi } from "vitest"

import { clearLocalMobileData } from "./local-session-cleanup"

describe("local mobile session cleanup", () => {
  it("runs both stores and blocks a new sign-in when secure storage deletion fails", async () => {
    const clearSession = vi.fn().mockRejectedValue(new Error("secure storage unavailable"))
    const purgeOfflineData = vi.fn().mockResolvedValue(undefined)

    await expect(clearLocalMobileData({ clearSession, purgeOfflineData }))
      .resolves.toBe("signed-out-cleanup-required")
    expect(clearSession).toHaveBeenCalledOnce()
    expect(purgeOfflineData).toHaveBeenCalledOnce()
  })

  it("runs both stores and blocks a new sign-in when SQLite purge fails", async () => {
    const clearSession = vi.fn().mockResolvedValue(undefined)
    const purgeOfflineData = vi.fn().mockRejectedValue(new Error("sqlite unavailable"))

    await expect(clearLocalMobileData({ clearSession, purgeOfflineData }))
      .resolves.toBe("signed-out-cleanup-required")
    expect(clearSession).toHaveBeenCalledOnce()
    expect(purgeOfflineData).toHaveBeenCalledOnce()
  })

  it("permits sign-in only after both persistent stores are clean", async () => {
    await expect(clearLocalMobileData({
      clearSession: vi.fn().mockResolvedValue(undefined),
      purgeOfflineData: vi.fn().mockResolvedValue(undefined),
    })).resolves.toBe("signed-out-clean")
  })
})

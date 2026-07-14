import { describe, expect, it, vi } from "vitest"

import {
  recordSuccessfulLogin,
  recordSuccessfulLoginSafely,
} from "./last-login"

describe("last-login tracking", () => {
  it("records the timestamp after a successful authentication", async () => {
    const update = vi.fn().mockResolvedValue({})
    const loggedInAt = new Date("2026-07-14T20:15:00.000Z")

    await recordSuccessfulLogin({
      now: () => loggedInAt,
      store: { user: { update } },
      userId: "user-1",
    })

    expect(update).toHaveBeenCalledWith({
      data: {
        lastLoginAt: loggedInAt,
      },
      where: {
        id: "user-1",
      },
    })
  })

  it("does not write when Auth.js has no user identifier", async () => {
    const update = vi.fn()

    await recordSuccessfulLogin({
      store: { user: { update } },
      userId: undefined,
    })

    expect(update).not.toHaveBeenCalled()
  })

  it("does not make a completed sign-in fail when tracking is unavailable", async () => {
    const update = vi.fn().mockRejectedValue(new Error("Database unavailable"))
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)

    await expect(
      recordSuccessfulLoginSafely({
        store: { user: { update } },
        userId: "user-1",
      }),
    ).resolves.toBeUndefined()

    expect(consoleError).toHaveBeenCalledWith("Failed to record successful sign-in.")
    consoleError.mockRestore()
  })
})

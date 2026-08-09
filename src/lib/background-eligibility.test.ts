import { describe, expect, it, vi } from "vitest"

import {
  assessBackgroundEligibility,
  getBackgroundEligibility,
} from "./background-eligibility"

describe("background eligibility", () => {
  it("denies every background channel when the current account is disabled", () => {
    expect(
      assessBackgroundEligibility({
        disabledAt: new Date("2026-08-09T12:00:00.000Z"),
        emailVerified: new Date("2026-08-01T12:00:00.000Z"),
        id: "user-1",
        plan: "FREE",
      })
    ).toEqual({
      active: false,
      aiAllowed: false,
      emailAllowed: false,
      pushAllowed: false,
      reason: "account-disabled",
    })
  })

  it("allows active work but withholds email until verification", () => {
    expect(
      assessBackgroundEligibility({
        disabledAt: null,
        emailVerified: null,
        id: "user-1",
        plan: "FREE",
      })
    ).toEqual({
      active: true,
      aiAllowed: true,
      emailAllowed: false,
      pushAllowed: true,
      reason: "email-unverified",
    })
  })

  it("denies an account that no longer exists or has an unknown plan", () => {
    expect(assessBackgroundEligibility(null).reason).toBe("account-missing")
    expect(
      assessBackgroundEligibility({
        disabledAt: null,
        emailVerified: new Date("2026-08-01T12:00:00.000Z"),
        id: "user-1",
        plan: "UNKNOWN" as "FREE",
      }).reason
    ).toBe("plan-ineligible")
  })

  it("loads the current database record instead of accepting eligibility from a job", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      disabledAt: null,
      emailVerified: new Date("2026-08-01T12:00:00.000Z"),
      id: "user-1",
      plan: "PRO",
    })

    await expect(
      getBackgroundEligibility({
        store: { user: { findUnique } },
        userId: "user-1",
      })
    ).resolves.toMatchObject({ reason: "eligible" })

    expect(findUnique).toHaveBeenCalledWith({
      select: {
        disabledAt: true,
        emailVerified: true,
        id: true,
        plan: true,
      },
      where: { id: "user-1" },
    })
  })
})

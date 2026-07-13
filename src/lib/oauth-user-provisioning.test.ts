import { describe, expect, it, vi } from "vitest"

import type { PrismaClient } from "../generated/prisma/client"

import { applyVerifiedOAuthDefaults } from "./oauth-user-provisioning"

function createStore(emailVerified: Date | null) {
  return {
    user: {
      findUnique: vi.fn().mockResolvedValue({ emailVerified }),
      update: vi.fn().mockResolvedValue({}),
    },
  } as unknown as Pick<PrismaClient, "user">
}

describe("verified OAuth user provisioning", () => {
  it("marks the Google account verified without assigning an application role", async () => {
    const store = createStore(null)
    const onFirstVerification = vi.fn().mockResolvedValue(undefined)

    await applyVerifiedOAuthDefaults({
      email: "  OWNER@example.com ",
      onFirstVerification,
      store,
      userId: "user-1",
    })

    const update = vi.mocked(store.user.update).mock.calls[0]?.[0]

    expect(update).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "owner@example.com",
          emailVerified: expect.any(Date),
        }),
        where: { id: "user-1" },
      })
    )
    expect(update?.data).not.toHaveProperty("role")
    expect(update?.data).not.toHaveProperty("plan")
    expect(onFirstVerification).toHaveBeenCalledWith("owner@example.com")
  })

  it("preserves an existing verified account state without sending another welcome email", async () => {
    const verifiedAt = new Date("2026-07-12T12:00:00.000Z")
    const store = createStore(verifiedAt)
    const onFirstVerification = vi.fn().mockResolvedValue(undefined)

    await applyVerifiedOAuthDefaults({
      email: "owner@example.com",
      onFirstVerification,
      store,
      userId: "user-1",
    })

    expect(store.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ emailVerified: verifiedAt }),
      })
    )
    expect(onFirstVerification).not.toHaveBeenCalled()
  })
})

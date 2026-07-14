import { beforeEach, describe, expect, it, vi } from "vitest"

const { requireFreshUserMock } = vi.hoisted(() => ({ requireFreshUserMock: vi.fn() }))

vi.mock("@/lib/authorization", () => ({ requireFreshUser: requireFreshUserMock }))

import {
  assertChatMutationOrigin,
  ChatAccessError,
  requireChatEligibleUser,
} from "./access"

describe("chat mutation origin checks", () => {
  const environment = {
    APP_ORIGIN: "https://arcticrss.example",
    ARCTIC_IRC_ENABLED: "true",
  }

  beforeEach(() => {
    requireFreshUserMock.mockReset()
    requireFreshUserMock.mockResolvedValue({
      authVersion: 0,
      disabledAt: null,
      emailVerified: new Date("2026-01-01T00:00:00.000Z"),
      id: "user-1",
      plan: "FREE",
      role: "USER",
    })
  })

  it("allows a mutation from the exact configured application origin", () => {
    expect(() =>
      assertChatMutationOrigin(
        new Request("https://arcticrss.example/api/chat/profile", {
          headers: { origin: "https://arcticrss.example" },
          method: "POST",
        }),
        environment
      )
    ).not.toThrow()
  })

  it("rejects missing and cross-site origins before a chat mutation can run", () => {
    for (const origin of [null, "https://attacker.example"]) {
      try {
        assertChatMutationOrigin(
          new Request("https://arcticrss.example/api/chat/profile", {
            headers: origin ? { origin } : {},
            method: "POST",
          }),
          environment
        )
        throw new Error("Expected origin validation to fail.")
      } catch (error) {
        expect(error).toBeInstanceOf(ChatAccessError)
        expect((error as ChatAccessError).code).toBe("invalid-origin")
      }
    }
  })

  it("does not query beta access while the allowlist flag is off", async () => {
    const store = {
      chatBetaAccess: { findFirst: vi.fn() },
      chatPolicyAcceptance: {
        findUnique: vi.fn().mockResolvedValue({ policyVersion: "launch-policy-v1" }),
      },
    }

    await expect(
      requireChatEligibleUser({
        environment,
        session: {} as never,
        store: store as never,
      })
    ).resolves.toMatchObject({ id: "user-1" })
    expect(store.chatBetaAccess.findFirst).not.toHaveBeenCalled()
  })

  it("requires an active beta invitation only when the allowlist flag is on", async () => {
    const store = {
      chatBetaAccess: { findFirst: vi.fn().mockResolvedValue(null) },
      chatPolicyAcceptance: { findUnique: vi.fn() },
    }

    await expect(
      requireChatEligibleUser({
        environment: { ...environment, ARCTIC_IRC_BETA_ALLOWLIST_ENABLED: "true" },
        session: {} as never,
        store: store as never,
      })
    ).rejects.toMatchObject({ code: "beta-access-required" })
    expect(store.chatBetaAccess.findFirst).toHaveBeenCalledWith({
      select: { id: true },
      where: { revokedAt: null, userId: "user-1" },
    })
  })

  it("requires the current policy acceptance before chat access", async () => {
    const store = {
      chatBetaAccess: { findFirst: vi.fn() },
      chatPolicyAcceptance: { findUnique: vi.fn().mockResolvedValue(null) },
    }

    await expect(
      requireChatEligibleUser({
        environment,
        session: {} as never,
        store: store as never,
      })
    ).rejects.toMatchObject({ code: "policy-acceptance-required" })
  })
})

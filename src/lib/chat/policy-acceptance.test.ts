import { describe, expect, it, vi } from "vitest"

import {
  ARCTICIRC_POLICY_VERSION,
  hasCurrentChatPolicyAcceptance,
  parseChatPolicyAcceptance,
} from "./policy-acceptance"

describe("ArcticIRC policy acceptance", () => {
  it("requires every activation confirmation", () => {
    expect(() => parseChatPolicyAcceptance({ attestAdult: true })).toThrow()
    expect(
      parseChatPolicyAcceptance({
        acceptCommunityGuidelines: true,
        acceptPrivacyPolicy: true,
        acceptTerms: true,
        attestAdult: true,
      })
    ).toMatchObject({ attestAdult: true })
  })

  it("only accepts the current policy version", async () => {
    const findUnique = vi.fn().mockResolvedValue({ policyVersion: ARCTICIRC_POLICY_VERSION })

    await expect(
      hasCurrentChatPolicyAcceptance("user-1", { chatPolicyAcceptance: { findUnique } } as never)
    ).resolves.toBe(true)

    findUnique.mockResolvedValue({ policyVersion: "older" })
    await expect(
      hasCurrentChatPolicyAcceptance("user-1", { chatPolicyAcceptance: { findUnique } } as never)
    ).resolves.toBe(false)
  })
})

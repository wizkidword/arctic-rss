import { afterEach, describe, expect, it, vi } from "vitest"

import {
  getSignupSuccessRedirectPath,
  isEmailVerificationRequired,
  shouldBlockLoginForUnverifiedEmail,
  shouldFailSignupWhenVerificationEmailFails,
} from "./email-verification-policy"

describe("email verification policy", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("requires email verification by default", () => {
    expect(isEmailVerificationRequired()).toBe(true)
    expect(getSignupSuccessRedirectPath()).toBe("/login?verify=1")
    expect(shouldBlockLoginForUnverifiedEmail(null)).toBe(true)
    expect(shouldFailSignupWhenVerificationEmailFails()).toBe(true)
  })

  it("allows a soft-launch mode when verification is disabled", () => {
    vi.stubEnv("REQUIRE_EMAIL_VERIFICATION", "false")

    expect(isEmailVerificationRequired()).toBe(false)
    expect(getSignupSuccessRedirectPath()).toBe("/login?registered=1")
    expect(shouldBlockLoginForUnverifiedEmail(null)).toBe(false)
    expect(shouldFailSignupWhenVerificationEmailFails()).toBe(false)
  })

  it("still treats verified users as allowed", () => {
    expect(
      shouldBlockLoginForUnverifiedEmail(
        new Date("2026-07-02T12:00:00.000Z")
      )
    ).toBe(false)
  })
})

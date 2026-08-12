import { describe, expect, it, vi } from "vitest"

import {
  issueDeviceAuthorizationCode,
  MobileAuthError,
  requireMobileAuthorizationReauthentication,
} from "./mobile-auth"

describe("requireMobileAuthorizationReauthentication", () => {
  it("accepts only a current credentials password for the current account version", async () => {
    const verify = vi.fn().mockResolvedValue(true)
    await expect(requireMobileAuthorizationReauthentication({
      currentPassword: "correct-password",
      expectedAuthVersion: 3,
      store: { user: { findUnique: vi.fn().mockResolvedValue({ authVersion: 3, disabledAt: null, passwordHash: "hash" }) } } as never,
      userId: "user-1",
      verify,
    })).resolves.toBeUndefined()
    expect(verify).toHaveBeenCalledWith("correct-password", "hash")
  })

  it("fails closed for OAuth-only accounts, stale sessions, and wrong passwords", async () => {
    for (const user of [
      { authVersion: 3, disabledAt: null, passwordHash: null },
      { authVersion: 2, disabledAt: null, passwordHash: "hash" },
      { authVersion: 3, disabledAt: null, passwordHash: "hash" },
    ]) {
      await expect(requireMobileAuthorizationReauthentication({
        currentPassword: "wrong-password",
        expectedAuthVersion: 3,
        store: { user: { findUnique: vi.fn().mockResolvedValue(user) } } as never,
        userId: "user-1",
        verify: vi.fn().mockResolvedValue(false),
      })).rejects.toMatchObject({ code: "authorization-invalid" } satisfies Partial<MobileAuthError>)
    }
  })

  it("does not leave a direct authorization-code issuer reachable at runtime", async () => {
    vi.stubEnv("NODE_ENV", "production")
    await expect(issueDeviceAuthorizationCode({
      authVersion: 1,
      request: {
        appVersion: "0.1.0-test",
        clientId: "android:com.arcticrss.reader",
        codeChallenge: "a".repeat(43),
        codeChallengeMethod: "S256",
        deviceName: "Test Android",
        nonce: "n".repeat(16),
        platform: "android",
        redirectUri: "https://arcticrss.com/mobile/auth/callback",
        state: "s".repeat(16),
      },
      store: {} as never,
      userId: "user-1",
    })).rejects.toMatchObject({ code: "authorization-invalid" } satisfies Partial<MobileAuthError>)
    vi.unstubAllEnvs()
  })
})

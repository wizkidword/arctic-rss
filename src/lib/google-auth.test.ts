import { afterEach, describe, expect, it, vi } from "vitest"

import { isGoogleAuthConfigured } from "./google-auth"

describe("Google auth configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("requires both the Google client id and secret", () => {
    vi.stubEnv("AUTH_GOOGLE_ID", "client-id")
    vi.stubEnv("AUTH_GOOGLE_SECRET", "")

    expect(isGoogleAuthConfigured()).toBe(false)

    vi.stubEnv("AUTH_GOOGLE_SECRET", "client-secret")

    expect(isGoogleAuthConfigured()).toBe(true)
  })
})

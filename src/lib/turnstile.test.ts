import { afterEach, describe, expect, it, vi } from "vitest"

import {
  getTurnstileSiteKey,
  getTurnstileTokenFromFormData,
  isTurnstileConfigured,
  verifyTurnstileToken,
} from "./turnstile"

describe("turnstile helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it("is disabled when no secret key is configured", () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "")

    expect(isTurnstileConfigured()).toBe(false)
  })

  it("reads the public site key from runtime environment", () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "  site-key  ")

    expect(getTurnstileSiteKey()).toBe("site-key")
  })

  it("skips verification when Turnstile is not configured", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "")
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    await expect(verifyTurnstileToken("reader-token")).resolves.toEqual({
      success: true,
      skipped: true,
    })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("rejects blank tokens when Turnstile is configured", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret-key")
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    await expect(verifyTurnstileToken(" ")).resolves.toEqual({
      success: false,
      errorCodes: ["missing-input-response"],
    })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("posts valid tokens to Cloudflare Siteverify", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret-key")
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        success: true,
        action: "login",
        hostname: "arcticrss.com",
      })
    )

    await expect(
      verifyTurnstileToken("reader-token", { expectedAction: "login" })
    ).resolves.toEqual({
      success: true,
      action: "login",
      hostname: "arcticrss.com",
    })

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      expect.objectContaining({
        method: "POST",
        body: expect.any(URLSearchParams),
      })
    )

    const body = fetchSpy.mock.calls[0]?.[1]?.body as URLSearchParams
    expect(body.get("secret")).toBe("secret-key")
    expect(body.get("response")).toBe("reader-token")
  })

  it("rejects successful tokens with the wrong action", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret-key")
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        success: true,
        action: "signup",
        hostname: "arcticrss.com",
      })
    )

    await expect(
      verifyTurnstileToken("reader-token", { expectedAction: "login" })
    ).resolves.toEqual({
      success: false,
      errorCodes: ["action-mismatch"],
    })
  })

  it("returns Cloudflare error codes for failed validation", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret-key")
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        success: false,
        "error-codes": ["timeout-or-duplicate"],
      })
    )

    await expect(verifyTurnstileToken("reader-token")).resolves.toEqual({
      success: false,
      errorCodes: ["timeout-or-duplicate"],
    })
  })

  it("reads the standard Turnstile token field from form data", () => {
    const formData = new FormData()
    formData.set("cf-turnstile-response", "reader-token")

    expect(getTurnstileTokenFromFormData(formData)).toBe("reader-token")
  })
})

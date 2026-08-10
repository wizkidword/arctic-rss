import { createHash } from "node:crypto"

import { describe, expect, it, vi } from "vitest"

import {
  MobileApiClient,
  MobileApiError,
  MobileSessionManager,
  assertQueuedMutation,
  createPkceAuthorization,
  selectMobileCacheEvictions,
} from "./index"

describe("mobile client safeguards", () => {
  it("requires an HTTPS origin outside an explicit development build", () => {
    expect(() => new MobileApiClient({ origin: "http://arcticrss.example" })).toThrow(/HTTPS/)
    expect(() => new MobileApiClient({ origin: "https://arcticrss.example/not-an-origin" })).toThrow(/origin/)
    expect(() => new MobileApiClient({ allowInsecureDevelopmentOrigin: true, origin: "http://127.0.0.1:3000" })).not.toThrow()
  })

  it("sends a bearer token only to the reviewed API origin and keeps malformed failures generic", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("not json", { status: 502 }))
    const client = new MobileApiClient({
      fetch,
      getAccessToken: async () => "access-token-should-not-appear-in-errors",
      origin: "https://arcticrss.example",
    })

    await expect(client.me()).rejects.toEqual(
      expect.objectContaining<Partial<MobileApiError>>({
        code: "INTERNAL_ERROR",
        message: "Arctic RSS could not complete this request.",
        status: 502,
      })
    )
    expect(fetch).toHaveBeenCalledWith(
      "https://arcticrss.example/api/v1/me",
      expect.objectContaining({ headers: expect.any(Headers) })
    )
    const headers = fetch.mock.calls[0][1].headers as Headers
    expect(headers.get("authorization")).toBe("Bearer access-token-should-not-appear-in-errors")
  })

  it("makes deterministic URL-safe PKCE material with a SHA-256 challenge", async () => {
    const pkce = await createPkceAuthorization({
      randomBytes: (size) => Uint8Array.from({ length: size }, (_, index) => index),
      sha256: async (value) => createHash("sha256").update(value).digest(),
    })

    expect(pkce.codeVerifier).toMatch(/^[A-Za-z0-9_-]{86}$/)
    expect(pkce.nonce).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(pkce.state).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(pkce.codeChallenge).toBe(
      createHash("sha256").update(pkce.codeVerifier).digest("base64url")
    )
  })

  it("keeps an offline cache bounded and rejects unsafe queued writes", () => {
    expect(
      selectMobileCacheEvictions(
        [
          { accessedAt: 1, byteCount: 100, key: "old", updatedAt: 1 },
          { accessedAt: 3, byteCount: 100, key: "new", updatedAt: 3 },
        ],
        4,
        { maximumCacheBytes: 150, maximumCachedEntries: 10, maximumEntryAgeMs: 10, maximumPendingMutations: 1 }
      )
    ).toEqual(["old"])
    expect(() =>
      assertQueuedMutation({
        idempotencyKey: "x".repeat(16),
        method: "POST",
        path: "/api/v1/reader",
      })
    ).toThrow(/offline scope/)
  })

  it("does not discard a session on a retryable refresh failure", async () => {
    const store = {
      clear: vi.fn().mockResolvedValue(undefined),
      read: vi.fn().mockResolvedValue({
        accessToken: "old",
        accessTokenExpiresAt: 1,
        accessTokenExpiresIn: 60,
        refreshToken: "refresh",
      }),
      write: vi.fn().mockResolvedValue(undefined),
    }
    const retryable = new Error("offline")
    const session = new MobileSessionManager(
      store,
      { refresh: vi.fn().mockRejectedValue(retryable) },
      { isRetryableFailure: (error) => error === retryable, now: () => 1_000, refreshSkewMs: 0 }
    )

    await session.hydrate()
    await expect(session.getAccessToken()).rejects.toBe(retryable)
    expect(store.clear).not.toHaveBeenCalled()
    expect(session.isSignedIn()).toBe(true)
  })
})

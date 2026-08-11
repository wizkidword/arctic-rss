import { createHash } from "node:crypto"

import { describe, expect, it, vi } from "vitest"

import {
  MobileApiClient,
  MobileApiError,
  MOBILE_TOKEN_BUNDLE_SCHEMA_VERSION,
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

  it("does not send a sync milestone before the local client has committed the page", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("not json", { status: 502 }))
    const client = new MobileApiClient({
      fetch,
      getAccessToken: async () => "device-token",
      origin: "https://arcticrss.example",
    })

    await expect(client.sync()).rejects.toBeInstanceOf(MobileApiError)

    const headers = fetch.mock.calls[0][1].headers as Headers
    expect(headers.get("x-arctic-rss-client-platform")).toBeNull()
    expect(headers.get("x-arctic-rss-product-milestone")).toBeNull()
  })

  it("uses the private bootstrap endpoint only with the current device session", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("not json", { status: 502 }))
    const client = new MobileApiClient({
      fetch,
      getAccessToken: async () => "device-token",
      origin: "https://arcticrss.example",
    })

    await expect(client.syncBootstrap()).rejects.toBeInstanceOf(MobileApiError)

    expect(fetch).toHaveBeenCalledWith(
      "https://arcticrss.example/api/v1/sync/bootstrap",
      expect.objectContaining({ headers: expect.any(Headers), method: "GET" })
    )
    expect((fetch.mock.calls[0][1].headers as Headers).get("authorization")).toBe("Bearer device-token")
  })

  it("marks only bounded offline mutation replays without adding mutation data", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("not json", { status: 502 }))
    const client = new MobileApiClient({
      fetch,
      getAccessToken: async () => "device-token",
      origin: "https://arcticrss.example",
    })

    await expect(
      client.replayMutation({
        body: { isRead: true },
        idempotencyKey: "a".repeat(16),
        method: "PATCH",
        path: "/api/v1/articles/article_1/state",
      })
    ).rejects.toBeInstanceOf(MobileApiError)

    const headers = fetch.mock.calls[0][1].headers as Headers
    expect(headers.get("x-arctic-rss-mutation-replay")).toBe("1")
  })

  it("replays one authenticated request after a coordinated token refresh", async () => {
    const authorizationHeaders: Array<string | null> = []
    const fetch = vi.fn(async (_url: string, init: RequestInit) => {
      authorizationHeaders.push((init.headers as Headers).get("authorization"))
      if (authorizationHeaders.length === 1) {
        return new Response(JSON.stringify({ error: { code: "MOBILE_DEVICE_SESSION_REQUIRED" } }), { status: 401 })
      }
      return new Response(JSON.stringify({
        data: { email: "reader@example.test", id: "reader_1", name: null, plan: "FREE" },
        meta: { requestId: "11111111-1111-4111-8111-111111111111" },
      }), { status: 200 })
    })
    const refreshAccessToken = vi.fn().mockResolvedValue("new-access-token")
    const client = new MobileApiClient({
      fetch: fetch as typeof globalThis.fetch,
      getAccessToken: async () => "old-access-token",
      origin: "https://arcticrss.example",
      refreshAccessToken,
    })

    await expect(client.me()).resolves.toMatchObject({ data: { id: "reader_1" } })
    expect(refreshAccessToken).toHaveBeenCalledTimes(1)
    expect(authorizationHeaders).toEqual(["Bearer old-access-token", "Bearer new-access-token"])
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it("bounds a hanging read with a deadline and forwards caller cancellation", async () => {
    const fetch = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          ;(init.signal as AbortSignal).addEventListener("abort", () => reject(new Error("aborted")))
        })
    )
    const client = new MobileApiClient({
      fetch: fetch as typeof globalThis.fetch,
      getAccessToken: async () => "device-token",
      origin: "https://arcticrss.example",
      readDeadlineMs: 1_000,
    })

    await expect(client.me()).rejects.toMatchObject({
      code: "MOBILE_REQUEST_DEADLINE_EXCEEDED",
      retryable: true,
    })

    const controller = new AbortController()
    const cancelled = client.me({ signal: controller.signal })
    controller.abort()
    await expect(cancelled).rejects.toMatchObject({
      code: "MOBILE_REQUEST_ABORTED",
      retryable: false,
    })
  })

  it("also bounds a stalled access-token read before starting a request", async () => {
    const fetch = vi.fn()
    const client = new MobileApiClient({
      fetch: fetch as typeof globalThis.fetch,
      getAccessToken: () => new Promise<string>(() => {}),
      origin: "https://arcticrss.example",
      readDeadlineMs: 1_000,
    })

    await expect(client.me()).rejects.toMatchObject({
      code: "MOBILE_REQUEST_DEADLINE_EXCEEDED",
      retryable: true,
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it("exposes Retry-After and refuses an oversized response before parsing it", async () => {
    const retryClient = new MobileApiClient({
      fetch: vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: "RATE_LIMITED",
              message: "Slow down",
              requestId: "11111111-1111-4111-8111-111111111111",
              retryable: true,
            },
          }),
          { headers: { "retry-after": "12" }, status: 429 }
        )
      ),
      getAccessToken: async () => "device-token",
      origin: "https://arcticrss.example",
    })
    await expect(retryClient.me()).rejects.toMatchObject({
      code: "RATE_LIMITED",
      retryAfterMs: 12_000,
      retryable: true,
      status: 429,
    })

    const oversizedClient = new MobileApiClient({
      fetch: vi.fn().mockResolvedValue(
        new Response("{}", { headers: { "content-length": "1025" }, status: 200 })
      ),
      getAccessToken: async () => "device-token",
      maximumResponseBytes: 1_024,
      origin: "https://arcticrss.example",
    })
    await expect(oversizedClient.me()).rejects.toMatchObject({
      code: "MOBILE_RESPONSE_TOO_LARGE",
    })
  })

  it("does not replay a non-idempotent write after access refresh", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: "MOBILE_DEVICE_SESSION_REQUIRED", message: "Sign in", retryable: false } }),
        { status: 401 }
      )
    )
    const refreshAccessToken = vi.fn().mockResolvedValue("replacement")
    const client = new MobileApiClient({
      fetch: fetch as typeof globalThis.fetch,
      getAccessToken: async () => "device-token",
      origin: "https://arcticrss.example",
      refreshAccessToken,
    })

    await expect(client.logout()).rejects.toBeInstanceOf(MobileApiError)
    expect(refreshAccessToken).not.toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledOnce()
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
        mobileDeviceId: "device_1",
        refreshToken: "refresh",
        schemaVersion: MOBILE_TOKEN_BUNDLE_SCHEMA_VERSION,
        userId: "user_1",
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

  it("shares one refresh and publishes its bundle only after persistence succeeds", async () => {
    let resolveRefresh: ((value: { accessToken: string; accessTokenExpiresIn: number; mobileDeviceId: string; refreshToken: string; userId: string }) => void) | undefined
    const refreshed = new Promise<{ accessToken: string; accessTokenExpiresIn: number; mobileDeviceId: string; refreshToken: string; userId: string }>((resolve) => {
      resolveRefresh = resolve
    })
    const store = {
      clear: vi.fn().mockResolvedValue(undefined),
      read: vi.fn().mockResolvedValue(storedTokens()),
      write: vi.fn().mockResolvedValue(undefined),
    }
    const refresh = vi.fn().mockReturnValue(refreshed)
    const session = new MobileSessionManager(
      store,
      { refresh },
      { now: () => 1_000, refreshSkewMs: 0 }
    )

    await session.hydrate()
    const callers = Array.from({ length: 20 }, () => session.getAccessToken())
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(store.write).not.toHaveBeenCalled()

    resolveRefresh?.({ accessToken: "new-access", accessTokenExpiresIn: 60, mobileDeviceId: "device_1", refreshToken: "new-refresh", userId: "user_1" })
    await expect(Promise.all(callers)).resolves.toEqual(Array.from({ length: 20 }, () => "new-access"))
    expect(store.write).toHaveBeenCalledTimes(1)
    expect(session.isSignedIn()).toBe(true)
  })

  it("preserves the old complete bundle after a retryable persistence failure", async () => {
    const persistenceFailure = new Error("secure storage unavailable")
    const store = {
      clear: vi.fn().mockResolvedValue(undefined),
      read: vi.fn().mockResolvedValue(storedTokens()),
      write: vi.fn().mockRejectedValue(persistenceFailure),
    }
    const session = new MobileSessionManager(
      store,
      { refresh: vi.fn().mockResolvedValue({ accessToken: "new", accessTokenExpiresIn: 60, mobileDeviceId: "device_1", refreshToken: "next", userId: "user_1" }) },
      { isRetryableFailure: (error) => error === persistenceFailure, now: () => 1_000, refreshSkewMs: 0 }
    )

    await session.hydrate()
    await expect(session.getAccessToken()).rejects.toBe(persistenceFailure)
    expect(store.clear).not.toHaveBeenCalled()
    expect(session.isSignedIn()).toBe(true)
    expect(store.write).toHaveBeenCalledTimes(1)
  })

  it("clears a terminal refresh failure once even when many callers are waiting", async () => {
    const terminal = new Error("refresh revoked")
    const store = {
      clear: vi.fn().mockResolvedValue(undefined),
      read: vi.fn().mockResolvedValue(storedTokens()),
      write: vi.fn().mockResolvedValue(undefined),
    }
    const refresh = vi.fn().mockRejectedValue(terminal)
    const session = new MobileSessionManager(store, { refresh }, { now: () => 1_000, refreshSkewMs: 0 })

    await session.hydrate()
    const callers = Array.from({ length: 20 }, () => session.getAccessToken())

    await expect(Promise.all(callers)).rejects.toBe(terminal)
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(store.clear).toHaveBeenCalledTimes(1)
    expect(session.isSignedIn()).toBe(false)
  })

  it("does not restore tokens when local sign-out supersedes an in-flight refresh", async () => {
    let resolveRefresh: ((value: { accessToken: string; accessTokenExpiresIn: number; mobileDeviceId: string; refreshToken: string; userId: string }) => void) | undefined
    const refresh = new Promise<{ accessToken: string; accessTokenExpiresIn: number; mobileDeviceId: string; refreshToken: string; userId: string }>((resolve) => {
      resolveRefresh = resolve
    })
    const store = {
      clear: vi.fn().mockResolvedValue(undefined),
      read: vi.fn().mockResolvedValue(storedTokens()),
      write: vi.fn().mockResolvedValue(undefined),
    }
    const session = new MobileSessionManager(store, { refresh: vi.fn().mockReturnValue(refresh) }, {
      now: () => 1_000,
      refreshSkewMs: 0,
    })

    await session.hydrate()
    const access = session.getAccessToken()
    await session.clear()
    resolveRefresh?.({ accessToken: "new", accessTokenExpiresIn: 60, mobileDeviceId: "device_1", refreshToken: "next", userId: "user_1" })

    await expect(access).rejects.toThrow()
    expect(store.write).not.toHaveBeenCalled()
    expect(store.clear).toHaveBeenCalledTimes(1)
    expect(session.isSignedIn()).toBe(false)
  })
})

function storedTokens() {
  return {
    accessToken: "old",
    accessTokenExpiresAt: 1,
    accessTokenExpiresIn: 60,
    mobileDeviceId: "device_1",
    refreshToken: "refresh",
    schemaVersion: MOBILE_TOKEN_BUNDLE_SCHEMA_VERSION,
    userId: "user_1",
  } as const
}

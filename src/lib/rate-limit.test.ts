import { afterEach, describe, expect, it, vi } from "vitest"

import {
  enforceRateLimit,
  getTrustedClientIp,
  type RateLimitStore,
} from "./rate-limit"

function createCounterStore() {
  const counters = new Map<string, number>()

  const store: RateLimitStore = {
    eval: vi.fn(async (_script, _numberOfKeys, key, windowMs) => {
      const count = (counters.get(String(key)) ?? 0) + 1
      counters.set(String(key), count)

      return [count, Number(windowMs)]
    }),
  }

  return store
}

describe("rate limiter", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("uses the same account keys regardless of email casing", async () => {
    const store = createCounterStore()

    await enforceRateLimit(
      {
        account: " Reader@Example.com ",
        action: "login",
        ip: "198.51.100.8",
      },
      { store }
    )
    const firstKeys = (store.eval as ReturnType<typeof vi.fn>).mock.calls.map(
      (call) => call[2]
    )

    await enforceRateLimit(
      {
        account: "reader@example.com",
        action: "login",
        ip: "198.51.100.8",
      },
      { store }
    )
    const secondKeys = (store.eval as ReturnType<typeof vi.fn>).mock.calls
      .slice(3)
      .map((call) => call[2])

    expect(secondKeys).toEqual(firstKeys)
    expect(firstKeys.join(" ")).not.toContain("reader@example.com")
  })

  it("uses bounded windows so a user is not permanently locked out", async () => {
    const store = createCounterStore()

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(
        enforceRateLimit(
          { action: "verification_resend", userId: "user-123" },
          { store }
        )
      ).resolves.toEqual({ allowed: true })
    }

    await expect(
      enforceRateLimit(
        { action: "verification_resend", userId: "user-123" },
        { store }
      )
    ).resolves.toEqual({
      allowed: false,
      reason: "limited",
      retryAfterSeconds: 3600,
      scope: "user",
    })
  })

  it("shares a Redis counter across application instances", async () => {
    const redisStore = createCounterStore()
    const firstInstance = { store: redisStore }
    const secondInstance = { store: redisStore }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(
        enforceRateLimit(
          { action: "verification_resend", userId: "user-456" },
          attempt % 2 === 0 ? firstInstance : secondInstance
        )
      ).resolves.toEqual({ allowed: true })
    }

    await expect(
      enforceRateLimit(
        { action: "verification_resend", userId: "user-456" },
        secondInstance
      )
    ).resolves.toMatchObject({
      allowed: false,
      reason: "limited",
    })
  })

  it("fails closed when Redis cannot be reached", async () => {
    const store: RateLimitStore = {
      eval: vi.fn(async () => {
        throw new Error("Redis unavailable")
      }),
    }
    const securityLog = vi.spyOn(console, "warn").mockImplementation(() => {})

    await expect(
      enforceRateLimit({ action: "signup", account: "reader@example.com" }, { store })
    ).resolves.toEqual({
      allowed: false,
      reason: "unavailable",
    })
    expect(securityLog).toHaveBeenCalledWith(
      expect.stringContaining('"event":"rate_limit_rejected"')
    )
    expect(securityLog).not.toHaveBeenCalledWith(
      expect.stringContaining("reader@example.com")
    )
  })

  it("only trusts the Cloudflare client IP header", () => {
    expect(
      getTrustedClientIp(
        new Headers({
          "cf-connecting-ip": "2001:DB8::1",
          "x-forwarded-for": "203.0.113.9",
        })
      )
    ).toBe("2001:db8::1")
    expect(
      getTrustedClientIp(new Headers({ "x-forwarded-for": "203.0.113.9" }))
    ).toBeNull()
    expect(
      getTrustedClientIp(new Headers({ "cf-connecting-ip": "not-an-ip" }))
    ).toBeNull()
  })
})

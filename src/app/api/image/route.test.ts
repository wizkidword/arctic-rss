import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  enforceRateLimit: vi.fn(),
  getTrustedClientIp: vi.fn(),
  normalizeHttpUrl: vi.fn((value: string) => new URL(value)),
  safeFetchBytes: vi.fn(),
}))

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  getTrustedClientIp: mocks.getTrustedClientIp,
}))

vi.mock("@/lib/url-safety", () => ({
  FeedFetchError: class FeedFetchError extends Error {},
  UnsafeUrlError: class UnsafeUrlError extends Error {},
  normalizeHttpUrl: mocks.normalizeHttpUrl,
  safeFetchBytes: mocks.safeFetchBytes,
}))

import { NextRequest } from "next/server"

import { GET } from "./route"

describe("image proxy endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.enforceRateLimit.mockResolvedValue({ allowed: true })
    mocks.getTrustedClientIp.mockReturnValue("198.51.100.20")
    mocks.safeFetchBytes.mockResolvedValue({
      bytes: new Uint8Array([137, 80, 78, 71]),
      contentType: "image/png; charset=binary",
      url: new URL("https://images.example/photo.png"),
    })
  })

  it("serves validated image bytes with scoped caching and privacy headers", async () => {
    const response = await GET(
      new NextRequest(
        "https://arcticrss.com/api/image?url=https%3A%2F%2Fimages.example%2Fphoto.png"
      )
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("image/png")
    expect(response.headers.get("cache-control")).toContain("s-maxage=604800")
    expect(response.headers.get("cross-origin-resource-policy")).toBe(
      "same-origin"
    )
    expect(response.headers.get("referrer-policy")).toBe("no-referrer")
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([
      137, 80, 78, 71,
    ])
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith({
      action: "image_proxy",
      ip: "198.51.100.20",
    })
    expect(mocks.safeFetchBytes).toHaveBeenCalledWith(
      new URL("https://images.example/photo.png"),
      expect.objectContaining({
        accept: expect.stringContaining("image/avif"),
        maxBytes: 5 * 1024 * 1024,
        userAgent: "ArcticRSS Image Proxy/0.1",
      })
    )
  })

  it("rejects non-image responses and requests without a source URL", async () => {
    mocks.safeFetchBytes.mockResolvedValue({
      bytes: new Uint8Array([60, 104, 116, 109, 108, 62]),
      contentType: "text/html",
      url: new URL("https://images.example/not-an-image"),
    })

    await expect(
      GET(
        new NextRequest(
          "https://arcticrss.com/api/image?url=https%3A%2F%2Fimages.example%2Fnot-an-image"
        )
      )
    ).resolves.toMatchObject({ status: 415 })

    await expect(
      GET(new NextRequest("https://arcticrss.com/api/image"))
    ).resolves.toMatchObject({ status: 400 })
  })

  it("fails closed when the image rate limit is unavailable", async () => {
    mocks.enforceRateLimit.mockResolvedValue({
      allowed: false,
      reason: "unavailable",
    })

    await expect(
      GET(
        new NextRequest(
          "https://arcticrss.com/api/image?url=https%3A%2F%2Fimages.example%2Fphoto.png"
        )
      )
    ).resolves.toMatchObject({ status: 503 })
    expect(mocks.safeFetchBytes).not.toHaveBeenCalled()
  })
})

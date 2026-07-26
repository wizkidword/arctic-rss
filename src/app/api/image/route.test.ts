import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  enforceRateLimit: vi.fn(),
  getTrustedClientIp: vi.fn(),
  ImageProxyCapacityError: class ImageProxyCapacityError extends Error {},
  ImageProxyValidationError: class ImageProxyValidationError extends Error {},
  normalizeHttpUrl: vi.fn((value: string) => new URL(value)),
  reencodeProxiedImage: vi.fn(),
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

vi.mock("@/lib/image-proxy", () => ({
  ImageProxyCapacityError: mocks.ImageProxyCapacityError,
  ImageProxyValidationError: mocks.ImageProxyValidationError,
  IMAGE_PROXY_ACCEPT:
    "image/avif,image/webp,image/apng,image/png,image/jpeg,image/gif,image/x-icon;q=0.9,*/*;q=0.1",
  IMAGE_PROXY_CACHE_CONTROL:
    "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
  IMAGE_PROXY_MAX_BYTES: 5 * 1024 * 1024,
  IMAGE_PROXY_USER_AGENT: "ArcticRSS Image Proxy/0.1",
  reencodeProxiedImage: mocks.reencodeProxiedImage,
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
    mocks.reencodeProxiedImage.mockResolvedValue({
      bytes: new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]),
      contentType: "image/webp",
    })
  })

  it("serves re-encoded image bytes with scoped caching and privacy headers", async () => {
    const response = await GET(
      new NextRequest(
        "https://arcticrss.com/api/image?url=https%3A%2F%2Fimages.example%2Fphoto.png"
      )
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("image/webp")
    expect(response.headers.get("cache-control")).toContain("s-maxage=604800")
    expect(response.headers.get("content-disposition")).toBe(
      'inline; filename="image.webp"'
    )
    expect(response.headers.get("content-security-policy")).toBe(
      "default-src 'none'; sandbox"
    )
    expect(response.headers.get("cross-origin-resource-policy")).toBe(
      "same-origin"
    )
    expect(response.headers.get("referrer-policy")).toBe("no-referrer")
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([
      82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80,
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
    expect(mocks.reencodeProxiedImage).toHaveBeenCalledWith(
      new Uint8Array([137, 80, 78, 71])
    )
  })

  it("rejects invalid image data and requests without a source URL", async () => {
    mocks.reencodeProxiedImage.mockRejectedValue(
      new mocks.ImageProxyValidationError("invalid image")
    )

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

  it("returns a temporary failure when decode capacity is exhausted", async () => {
    mocks.reencodeProxiedImage.mockRejectedValue(new mocks.ImageProxyCapacityError())

    const response = await GET(
      new NextRequest(
        "https://arcticrss.com/api/image?url=https%3A%2F%2Fimages.example%2Fphoto.png"
      )
    )

    expect(response.status).toBe(503)
    expect(response.headers.get("cache-control")).toBe("no-store")
  })
})

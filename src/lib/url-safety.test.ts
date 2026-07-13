import { describe, expect, it, vi } from "vitest"

import {
  assertUrlResolvesPublicly,
  createHostRequestLimiter,
  createPinnedLookup,
  isPrivateIpAddress,
  normalizeHttpUrl,
  safeFetchBytes,
  safeFetchText,
} from "./url-safety"

describe("feed URL safety", () => {
  it("normalizes bare hostnames as HTTPS URLs", () => {
    expect(normalizeHttpUrl("example.com/feed").href).toBe(
      "https://example.com/feed"
    )
  })

  it.each(["file:///etc/passwd", "ftp://example.com/feed"])(
    "only allows HTTP and HTTPS URLs (%s)",
    (url) => {
      expect(() => normalizeHttpUrl(url)).toThrow(
        "Only HTTP and HTTPS URLs are supported"
      )
    }
  )

  it("rejects embedded credentials and non-standard ports", () => {
    expect(() => normalizeHttpUrl("https://user:pass@example.com/feed")).toThrow(
      "URLs with embedded credentials are not allowed"
    )
    expect(() => normalizeHttpUrl("https://example.com:8443/feed")).toThrow(
      "Only standard HTTP and HTTPS ports are allowed"
    )
    expect(normalizeHttpUrl("http://example.com:80/feed").href).toBe(
      "http://example.com/feed"
    )
  })

  it.each([
    "http://localhost/feed",
    "http://127.0.0.1/feed",
    "http://[::1]/feed",
    "http://10.0.0.1/feed",
    "http://172.16.0.1/feed",
    "http://192.168.0.1/feed",
    "http://169.254.169.254/latest/meta-data",
    "http://[::ffff:192.168.0.1]/feed",
    "http://[::ffff:a9fe:a9fe]/feed",
    "http://printer/feed",
  ])("rejects internal destinations (%s)", (url) => {
    expect(() => normalizeHttpUrl(url)).toThrow(
      "Local and internal hostnames are not allowed"
    )
  })

  it("identifies private and local IP ranges", () => {
    expect(isPrivateIpAddress("127.0.0.1")).toBe(true)
    expect(isPrivateIpAddress("10.0.0.12")).toBe(true)
    expect(isPrivateIpAddress("172.20.1.1")).toBe(true)
    expect(isPrivateIpAddress("192.168.1.4")).toBe(true)
    expect(isPrivateIpAddress("169.254.10.20")).toBe(true)
    expect(isPrivateIpAddress("192.0.2.10")).toBe(true)
    expect(isPrivateIpAddress("198.51.100.10")).toBe(true)
    expect(isPrivateIpAddress("203.0.113.10")).toBe(true)
    expect(isPrivateIpAddress("::1")).toBe(true)
    expect(isPrivateIpAddress("fd00::1")).toBe(true)
    expect(isPrivateIpAddress("fe80::1")).toBe(true)
    expect(isPrivateIpAddress("2001:db8::1")).toBe(true)
    expect(isPrivateIpAddress("::ffff:a9fe:a9fe")).toBe(true)
    expect(isPrivateIpAddress("::ffff:0808:0808")).toBe(false)
    expect(isPrivateIpAddress("8.8.8.8")).toBe(false)
    expect(isPrivateIpAddress("2606:4700:4700::1111")).toBe(false)
  })

  it("allows a public IPv6 literal and avoids a DNS lookup for it", async () => {
    const lookup = vi.fn()
    const url = normalizeHttpUrl("https://[2606:4700:4700::1111]/feed")

    await expect(assertUrlResolvesPublicly(url, lookup)).resolves.toEqual({
      address: "2606:4700:4700::1111",
      family: 6,
    })
    expect(lookup).not.toHaveBeenCalled()
  })

  it("only returns a validated public DNS address", async () => {
    const lookup = vi.fn(async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "2606:4700:4700::1111", family: 6 },
    ])

    await expect(
      assertUrlResolvesPublicly(new URL("https://feeds.example.com/rss.xml"), lookup as never)
    ).resolves.toEqual({
      address: "93.184.216.34",
      family: 4,
    })
  })

  it("rejects a hostname when any DNS result is internal", async () => {
    const lookup = vi.fn(async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "::ffff:a9fe:a9fe", family: 6 },
    ])

    await expect(
      assertUrlResolvesPublicly(new URL("https://feeds.example.com/rss.xml"), lookup as never)
    ).rejects.toThrow("Local and internal hostnames are not allowed")
  })

  it("pins an outbound lookup to the validated address", async () => {
    const lookup = createPinnedLookup({
      address: "93.184.216.34",
      family: 4,
    })

    const result = await new Promise<{ address: string; family?: number }>((resolve, reject) => {
      lookup("attacker-controlled.example", {}, (error, address, family) => {
        if (error || typeof address !== "string") {
          reject(error ?? new Error("Expected one pinned address."))
          return
        }

        resolve({ address, family })
      })
    })

    expect(result).toEqual({ address: "93.184.216.34", family: 4 })
  })

  it("returns the pinned address in all-address lookup mode", async () => {
    const lookup = createPinnedLookup({
      address: "93.184.216.34",
      family: 4,
    })

    const result = await new Promise<Array<{ address: string; family: number }>>(
      (resolve, reject) => {
        lookup("attacker-controlled.example", { all: true }, (error, address) => {
          if (error || !Array.isArray(address)) {
            reject(error ?? new Error("Expected an array containing the pinned address."))
            return
          }

          resolve(address)
        })
      }
    )

    expect(result).toEqual([{ address: "93.184.216.34", family: 4 }])
  })

  it("bounds concurrent requests to each hostname", async () => {
    const limiter = createHostRequestLimiter(1)
    const releaseFirst = await limiter.acquire("feeds.example.com")
    let acquiredSecond = false
    const secondSlot = limiter.acquire("FEEDS.EXAMPLE.COM.").then((release) => {
      acquiredSecond = true
      return release
    })

    await Promise.resolve()
    expect(acquiredSecond).toBe(false)

    releaseFirst()
    const releaseSecond = await secondSlot
    expect(acquiredSecond).toBe(true)
    releaseSecond()
  })

  it("identifies Arctic RSS with the public site URL when fetching feeds", async () => {
    const fetchImpl = vi.fn(async () => new Response("<rss></rss>"))
    const lookup = vi.fn(async () => [{ address: "93.184.216.34", family: 4 }])

    await safeFetchText(new URL("https://example.com/feed"), {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      lookup: lookup as never,
    })

    expect(fetchImpl).toHaveBeenCalledWith(
      new URL("https://example.com/feed"),
      expect.objectContaining({
        headers: expect.objectContaining({
          "user-agent": expect.stringContaining("https://arcticrss.com"),
        }),
      })
    )
  })

  it.each(["http://feeds.example.com/rss.xml", "https://feeds.example.com/rss.xml"])(
    "allows a valid public feed URL (%s)",
    async (url) => {
      const lookup = vi.fn(async () => [{ address: "93.184.216.34", family: 4 }])
      const fetchImpl = vi.fn(async () => new Response("<rss></rss>"))

      const result = await safeFetchText(new URL(url), {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        lookup: lookup as never,
      })

      expect(result.text).toBe("<rss></rss>")
      expect(result.url.href).toBe(url)
    }
  )

  it("blocks a redirect from a public hostname to an internal address", async () => {
    const lookup = vi.fn(async () => [{ address: "93.184.216.34", family: 4 }])
    const fetchImpl = vi.fn(async () =>
      new Response(null, {
        headers: { location: "http://127.0.0.1/internal" },
        status: 302,
      })
    )

    await expect(
      safeFetchText(new URL("https://feeds.example.com/rss.xml"), {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        lookup: lookup as never,
      })
    ).rejects.toThrow("Local and internal hostnames are not allowed")
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it("stops after a bounded number of redirects", async () => {
    const lookup = vi.fn(async () => [{ address: "93.184.216.34", family: 4 }])
    const fetchImpl = vi.fn(async () =>
      new Response(null, {
        headers: { location: "https://feeds.example.com/rss.xml" },
        status: 302,
      })
    )

    await expect(
      safeFetchText(new URL("https://feeds.example.com/rss.xml"), {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        lookup: lookup as never,
      })
    ).rejects.toThrow("The URL redirected too many times")
    expect(fetchImpl).toHaveBeenCalledTimes(6)
  })

  it("returns bounded binary responses for the image proxy", async () => {
    const lookup = vi.fn(async () => [{ address: "93.184.216.34", family: 4 }])
    const fetchImpl = vi.fn(async () =>
      new Response(new Uint8Array([137, 80, 78, 71]), {
        headers: { "content-type": "image/png" },
      })
    )

    const result = await safeFetchBytes(new URL("https://images.example.com/logo.png"), {
      accept: "image/avif,image/webp,image/*;q=0.8",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      lookup: lookup as never,
      maxBytes: 16,
      userAgent: "ArcticRSS Image Proxy/0.1",
    })

    expect(result.contentType).toBe("image/png")
    expect([...result.bytes]).toEqual([137, 80, 78, 71])
    expect(fetchImpl).toHaveBeenCalledWith(
      new URL("https://images.example.com/logo.png"),
      expect.objectContaining({
        headers: {
          accept: "image/avif,image/webp,image/*;q=0.8",
          "user-agent": "ArcticRSS Image Proxy/0.1",
        },
      })
    )
  })

  it("applies one deadline across a redirect chain", async () => {
    const lookup = vi.fn(async () => [{ address: "93.184.216.34", family: 4 }])
    const fetchImpl = vi.fn(async () =>
      new Response(null, {
        headers: { location: "https://feeds.example.com/rss.xml" },
        status: 302,
      })
    )
    const now = vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValue(11)

    await expect(
      safeFetchText(new URL("https://feeds.example.com/rss.xml"), {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        lookup: lookup as never,
        now,
        totalTimeoutMs: 10,
      })
    ).rejects.toThrow("The URL request timed out")
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it("does not begin DNS resolution after the request deadline", async () => {
    const lookup = vi.fn(async () => [{ address: "93.184.216.34", family: 4 }])
    const now = vi.fn().mockReturnValueOnce(0).mockReturnValue(11)

    await expect(
      safeFetchText(new URL("https://feeds.example.com/rss.xml"), {
        fetchImpl: vi.fn() as unknown as typeof fetch,
        lookup: lookup as never,
        now,
        totalTimeoutMs: 10,
      })
    ).rejects.toThrow("The URL request timed out")
    expect(lookup).not.toHaveBeenCalled()
  })

  it("rejects oversized responses before reading them", async () => {
    const lookup = vi.fn(async () => [{ address: "93.184.216.34", family: 4 }])
    const fetchImpl = vi.fn(async () =>
      new Response("<rss></rss>", {
        headers: { "content-length": "32" },
      })
    )

    await expect(
      safeFetchText(new URL("https://feeds.example.com/rss.xml"), {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        lookup: lookup as never,
        maxBytes: 16,
      })
    ).rejects.toThrow("The response is too large to inspect safely")
  })

  it("returns a clear error when the request times out", async () => {
    const lookup = vi.fn(async () => [{ address: "93.184.216.34", family: 4 }])
    const fetchImpl = vi.fn(async () => {
      throw new DOMException("The operation timed out.", "TimeoutError")
    })

    await expect(
      safeFetchText(new URL("https://feeds.example.com/rss.xml"), {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        lookup: lookup as never,
      })
    ).rejects.toThrow("The URL request timed out")
  })
})

import { describe, expect, it, vi } from "vitest"

import { isPrivateIpAddress, normalizeHttpUrl, safeFetchText } from "./url-safety"

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
    expect(isPrivateIpAddress("::1")).toBe(true)
    expect(isPrivateIpAddress("fd00::1")).toBe(true)
    expect(isPrivateIpAddress("fe80::1")).toBe(true)
    expect(isPrivateIpAddress("8.8.8.8")).toBe(false)
    expect(isPrivateIpAddress("2606:4700:4700::1111")).toBe(false)
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

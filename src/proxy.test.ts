import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { proxy } from "./proxy"

function request(path: string, headers: HeadersInit = {}) {
  return new NextRequest(`http://localhost${path}`, { headers })
}

describe("proxy host validation", () => {
  beforeEach(() => {
    vi.stubEnv("APP_ALLOWED_HOSTS", "www.arcticrss.com")
    vi.stubEnv("APP_ORIGIN", "https://arcticrss.com")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("rejects a malicious Host header before routes and Auth.js can use it", () => {
    const response = proxy(request("/api/auth/signin", { host: "attacker.example" }))

    expect(response.status).toBe(400)
    expect(response.headers.get("cache-control")).toBe("no-store")
  })

  it("ignores malicious forwarded host and protocol headers", () => {
    const response = proxy(
      request("/login", {
        host: "arcticrss.com",
        "x-forwarded-host": "attacker.example",
        "x-forwarded-proto": "http",
      })
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("location")).toBeNull()
    expect(response.headers.get("strict-transport-security")).toContain(
      "max-age=31536000"
    )
  })

  it("redirects explicit aliases to the configured HTTPS canonical origin", () => {
    const response = proxy(
      request("/login?next=%2Fapp", { host: "www.arcticrss.com" })
    )

    expect(response.status).toBe(308)
    expect(response.headers.get("location")).toBe(
      "https://arcticrss.com/login?next=%2Fapp"
    )
  })

  it("redirects the canonical hostname when a proxy preserves port 80", () => {
    const response = proxy(request("/login", { host: "arcticrss.com:80" }))

    expect(response.status).toBe(308)
    expect(response.headers.get("location")).toBe(
      "https://arcticrss.com/login"
    )
  })

  it("rejects unexpected ports and Unicode/punycode host lookalikes", () => {
    expect(
      proxy(request("/login", { host: "arcticrss.com:444" })).status
    ).toBe(400)
    expect(
      proxy(request("/login", { host: "xn--bcher-kva.example" })).status
    ).toBe(400)
  })

  it("allows the loopback-only Docker health probe without a redirect", () => {
    const response = proxy(request("/api/health", { host: "127.0.0.1:3000" }))

    expect(response.status).toBe(200)
    expect(response.headers.get("location")).toBeNull()
    expect(response.headers.get("strict-transport-security")).toBeNull()
  })

  it("allows the loopback-only liveness probe without a redirect", () => {
    const response = proxy(request("/api/live", { host: "127.0.0.1:3000" }))

    expect(response.status).toBe(200)
    expect(response.headers.get("location")).toBeNull()
    expect(response.headers.get("strict-transport-security")).toBeNull()
  })

  it("keeps the liveness probe off the public origin", () => {
    const response = proxy(request("/api/live", { host: "arcticrss.com" }))

    expect(response.status).toBe(404)
  })
})

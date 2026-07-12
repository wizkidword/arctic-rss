import { describe, expect, it } from "vitest"

import nextConfig from "./next.config"

describe("nextConfig security headers", () => {
  it("adds compatible browser security headers to every path, including static files", async () => {
    expect(nextConfig.headers).toBeTypeOf("function")

    const configuredHeaders = await nextConfig.headers?.()

    expect(configuredHeaders).toContainEqual({
      headers: expect.arrayContaining([
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
        {
          key: "X-Content-Type-Options",
          value: "nosniff",
        },
        {
          key: "Referrer-Policy",
          value: "strict-origin-when-cross-origin",
        },
        {
          key: "X-Frame-Options",
          value: "SAMEORIGIN",
        },
        {
          key: "Permissions-Policy",
          value: "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
        },
        {
          key: "X-Permitted-Cross-Domain-Policies",
          value: "none",
        },
      ]),
      source: "/:path*",
    })
  })
})

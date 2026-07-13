import { afterEach, describe, expect, it, vi } from "vitest"

import { CSP_REPORT_MAX_BYTES } from "@/lib/content-security-policy"

import { POST } from "./route"

describe("CSP report endpoint", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("collects only sanitized CSP report metadata", async () => {
    const log = vi.spyOn(console, "warn").mockImplementation(() => {})
    const response = await POST(
      new Request("https://arcticrss.com/api/csp-report", {
        body: JSON.stringify({
          "csp-report": {
            "blocked-uri": "https://tracker.example/path?secret=not-retained",
            "effective-directive": "img-src",
          },
        }),
        headers: { "content-type": "application/csp-report" },
        method: "POST",
      })
    )

    expect(response.status).toBe(204)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('"blockedUri":"https://tracker.example"')
    )
    expect(log).not.toHaveBeenCalledWith(expect.stringContaining("secret"))
  })

  it("rejects malformed and oversized report bodies", async () => {
    await expect(
      POST(
        new Request("https://arcticrss.com/api/csp-report", {
          body: "not-json",
          method: "POST",
        })
      )
    ).resolves.toMatchObject({ status: 400 })

    await expect(
      POST(
        new Request("https://arcticrss.com/api/csp-report", {
          body: "x".repeat(CSP_REPORT_MAX_BYTES + 1),
          method: "POST",
        })
      )
    ).resolves.toMatchObject({ status: 413 })
  })
})

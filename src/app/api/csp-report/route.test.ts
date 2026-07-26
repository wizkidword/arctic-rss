import { afterEach, describe, expect, it, vi } from "vitest"

import { CSP_REPORT_MAX_BYTES } from "@/lib/content-security-policy"

const mocks = vi.hoisted(() => ({
  aggregateCspViolationReports: vi.fn(),
  enforceRateLimit: vi.fn(),
  getTrustedClientIp: vi.fn(),
}))

vi.mock("@/lib/csp-reporting", () => ({
  aggregateCspViolationReports: mocks.aggregateCspViolationReports,
}))

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  getTrustedClientIp: mocks.getTrustedClientIp,
}))

import { POST } from "./route"

describe("CSP report endpoint", () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  function allowReports() {
    mocks.getTrustedClientIp.mockReturnValue("198.51.100.5")
    mocks.enforceRateLimit.mockResolvedValue({ allowed: true })
    mocks.aggregateCspViolationReports.mockResolvedValue([
      {
        count: 1,
        directive: "img-src",
        source: "https://tracker.example",
      },
    ])
  }

  it("collects only sanitized CSP report metadata", async () => {
    allowReports()
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
    expect(mocks.enforceRateLimit).toHaveBeenNthCalledWith(1, {
      action: "csp_report",
      ip: "198.51.100.5",
    })
    expect(mocks.aggregateCspViolationReports).toHaveBeenCalledWith([
      expect.objectContaining({
        blockedUri: "https://tracker.example",
        effectiveDirective: "img-src",
      }),
    ])
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('"source":"https://tracker.example"')
    )
    expect(log).not.toHaveBeenCalledWith(expect.stringContaining("secret"))
  })

  it("rejects malformed and oversized report bodies", async () => {
    allowReports()
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

  it("enforces intake and aggregate-log limits without emitting rejected reports", async () => {
    mocks.getTrustedClientIp.mockReturnValue("198.51.100.5")
    mocks.enforceRateLimit.mockResolvedValueOnce({
      allowed: false,
      reason: "limited",
    })

    await expect(
      POST(
        new Request("https://arcticrss.com/api/csp-report", {
          body: JSON.stringify({ "csp-report": {} }),
          method: "POST",
        })
      )
    ).resolves.toMatchObject({ status: 429 })
    expect(mocks.aggregateCspViolationReports).not.toHaveBeenCalled()

    allowReports()
    mocks.enforceRateLimit
      .mockResolvedValueOnce({ allowed: true })
      .mockResolvedValueOnce({ allowed: false, reason: "limited" })
    const log = vi.spyOn(console, "warn").mockImplementation(() => {})

    await expect(
      POST(
        new Request("https://arcticrss.com/api/csp-report", {
          body: JSON.stringify({
            "csp-report": { "effective-directive": "img-src" },
          }),
          method: "POST",
        })
      )
    ).resolves.toMatchObject({ status: 204 })

    expect(mocks.enforceRateLimit).toHaveBeenLastCalledWith(
      { action: "csp_report_log", token: "aggregate" },
      { logRejections: false }
    )
    expect(log).not.toHaveBeenCalled()
  })

  it("fails closed when CSP aggregation storage is unavailable", async () => {
    allowReports()
    mocks.aggregateCspViolationReports.mockRejectedValue(new Error("Redis unavailable"))

    await expect(
      POST(
        new Request("https://arcticrss.com/api/csp-report", {
          body: JSON.stringify({ "csp-report": {} }),
          method: "POST",
        })
      )
    ).resolves.toMatchObject({ status: 503 })
  })
})

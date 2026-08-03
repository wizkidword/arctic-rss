import { describe, expect, it } from "vitest"

import {
  buildContentSecurityPolicy,
  parseCspViolationReports,
} from "./content-security-policy"

describe("content security policy", () => {
  it("enforces a nonce-bound policy with a local report collector", () => {
    const policy = buildContentSecurityPolicy("nonce-value", false)

    expect(policy).toContain("default-src 'self'")
    expect(policy).toContain("object-src 'none'")
    expect(policy).toContain("'nonce-nonce-value'")
    expect(policy).toContain("'strict-dynamic'")
    expect(policy).toContain(
      "frame-src https://www.youtube-nocookie.com https://challenges.cloudflare.com"
    )
    expect(policy).toContain(
      "report-uri /api/csp-report"
    )
    expect(policy).not.toContain("unsafe-eval")
    expect(policy).not.toContain("script-src 'self' 'unsafe-inline'")
    expect(policy).not.toContain("style-src 'self' 'nonce-nonce-value' 'unsafe-inline'")
  })

  it("keeps CSP report values useful without retaining full URLs", () => {
    expect(
      parseCspViolationReports({
        "csp-report": {
          "blocked-uri": "https://tracker.example/path?reader=email@example.com",
          "document-uri": "https://arcticrss.com/app?article=private",
          "effective-directive": "img-src",
          "violated-directive": "img-src 'self'",
        },
      })
    ).toEqual([
      {
        blockedUri: "https://tracker.example",
        disposition: null,
        documentUri: "https://arcticrss.com",
        effectiveDirective: "img-src",
        violatedDirective: "img-src 'self'",
      },
    ])
  })

  it("accepts Reporting API batches while ignoring unrelated data", () => {
    expect(
      parseCspViolationReports([
        { type: "network-error", body: {} },
        {
          type: "csp-violation",
          body: {
            "blocked-uri": "inline",
            disposition: "report",
            "effective-directive": "script-src-elem",
          },
        },
      ])
    ).toEqual([
      {
        blockedUri: "inline",
        disposition: "report",
        documentUri: null,
        effectiveDirective: "script-src-elem",
        violatedDirective: null,
      },
    ])
  })

  it("filters browser extension noise before it reaches the collector", () => {
    expect(
      parseCspViolationReports({
        "csp-report": {
          "blocked-uri": "chrome-extension://random-id/injected.js",
          "effective-directive": "script-src-elem",
        },
      })
    ).toEqual([])
  })
})

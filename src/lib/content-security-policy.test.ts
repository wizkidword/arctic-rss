import { describe, expect, it } from "vitest"

import {
  contentSecurityPolicyReportOnly,
  parseCspViolationReports,
} from "./content-security-policy"

describe("content security policy", () => {
  it("starts with an observing-only policy and a local report collector", () => {
    expect(contentSecurityPolicyReportOnly).toContain("default-src 'self'")
    expect(contentSecurityPolicyReportOnly).toContain("object-src 'none'")
    expect(contentSecurityPolicyReportOnly).toContain(
      "report-uri /api/csp-report"
    )
    expect(contentSecurityPolicyReportOnly).not.toContain("unsafe-eval")
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
})

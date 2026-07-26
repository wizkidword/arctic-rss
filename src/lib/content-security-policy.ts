const MAX_CSP_REPORTS_PER_REQUEST = 10
const MAX_CSP_REPORT_VALUE_LENGTH = 160

export const CSP_REPORT_MAX_BYTES = 8 * 1024
export const CSP_NONCE_HEADER = "x-nonce"

export function buildContentSecurityPolicy(
  nonce: string,
  isDevelopment = process.env.NODE_ENV !== "production"
) {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    [
      "script-src 'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      "https://www.googletagmanager.com",
      "https://challenges.cloudflare.com",
      ...(isDevelopment ? ["'unsafe-eval'"] : []),
    ].join(" "),
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob: https://www.google-analytics.com",
    "font-src 'self'",
    "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com",
    "media-src 'self' https:",
    "frame-src https://www.youtube-nocookie.com",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    "upgrade-insecure-requests",
    "report-uri /api/csp-report",
  ].join("; ")
}

type CspReportBody = Record<string, unknown>

export type CspViolationReport = {
  blockedUri: string | null
  disposition: string | null
  documentUri: string | null
  effectiveDirective: string | null
  violatedDirective: string | null
}

export function parseCspViolationReports(payload: unknown) {
  const bodies = reportBodies(payload)

  return bodies
    .filter((body) => !isBrowserExtensionNoise(body["blocked-uri"]))
    .map((body) => ({
        blockedUri: reportUrlValue(body["blocked-uri"]),
        disposition: reportTextValue(body.disposition),
        documentUri: reportUrlValue(body["document-uri"]),
        effectiveDirective: reportTextValue(body["effective-directive"]),
        violatedDirective: reportTextValue(body["violated-directive"]),
      }))
    .filter((report) =>
      Object.values(report).some((value) => value !== null)
    )
    .slice(0, MAX_CSP_REPORTS_PER_REQUEST)
}

function reportBodies(payload: unknown): CspReportBody[] {
  if (Array.isArray(payload)) {
    return payload
      .map((entry) => {
        if (!isRecord(entry) || entry.type !== "csp-violation") {
          return null
        }

        return isRecord(entry.body) ? entry.body : null
      })
      .filter((body): body is CspReportBody => body !== null)
  }

  if (isRecord(payload) && isRecord(payload["csp-report"])) {
    return [payload["csp-report"]]
  }

  return []
}

function reportTextValue(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.replace(/\s+/g, " ").trim()

  return normalized ? normalized.slice(0, MAX_CSP_REPORT_VALUE_LENGTH) : null
}

function reportUrlValue(value: unknown) {
  const normalized = reportTextValue(value)

  if (!normalized) {
    return null
  }

  if (["blob", "data", "eval", "inline", "wasm-eval"].includes(normalized)) {
    return normalized
  }

  try {
    const url = new URL(normalized)

    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : null
  } catch {
    return null
  }
}

function isBrowserExtensionNoise(value: unknown) {
  return (
    typeof value === "string" &&
    /^(?:chrome|moz|ms-browser|safari)-extension:/i.test(value.trim())
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

import {
  CSP_REPORT_MAX_BYTES,
  type CspViolationReport,
  parseCspViolationReports,
} from "@/lib/content-security-policy"
import { aggregateCspViolationReports } from "@/lib/csp-reporting"
import { enforceRateLimit, getTrustedClientIp } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length"))

  if (Number.isFinite(contentLength) && contentLength > CSP_REPORT_MAX_BYTES) {
    return noStoreResponse(413)
  }

  const intakeRateLimit = await enforceRateLimit({
    action: "csp_report",
    ip: getTrustedClientIp(request.headers),
  })

  if (!intakeRateLimit.allowed) {
    return noStoreResponse(intakeRateLimit.reason === "unavailable" ? 503 : 429)
  }

  const body = await request.text()

  if (new TextEncoder().encode(body).byteLength > CSP_REPORT_MAX_BYTES) {
    return noStoreResponse(413)
  }

  let reports: CspViolationReport[]

  try {
    reports = parseCspViolationReports(JSON.parse(body))
  } catch {
    return noStoreResponse(400)
  }

  try {
    const aggregates = await aggregateCspViolationReports(reports)

    for (const aggregate of aggregates) {
      const logRateLimit = await enforceRateLimit(
        { action: "csp_report_log", token: "aggregate" },
        { logRejections: false }
      )

      if (!logRateLimit.allowed) {
        break
      }

      console.warn(
        JSON.stringify({
          count: aggregate.count,
          directive: aggregate.directive,
          event: "csp_violation_observed",
          severity: aggregate.count === 1 ? "new" : "elevated",
          source: aggregate.source,
        })
      )
    }
  } catch {
    return noStoreResponse(503)
  }

  return noStoreResponse(204)
}

function noStoreResponse(status: number) {
  return new Response(null, {
    headers: {
      "Cache-Control": "no-store",
    },
    status,
  })
}

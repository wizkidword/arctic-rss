import {
  CSP_REPORT_MAX_BYTES,
  parseCspViolationReports,
} from "@/lib/content-security-policy"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length"))

  if (Number.isFinite(contentLength) && contentLength > CSP_REPORT_MAX_BYTES) {
    return noStoreResponse(413)
  }

  const body = await request.text()

  if (new TextEncoder().encode(body).byteLength > CSP_REPORT_MAX_BYTES) {
    return noStoreResponse(413)
  }

  try {
    const reports = parseCspViolationReports(JSON.parse(body))

    if (reports.length > 0) {
      console.warn(
        JSON.stringify({
          event: "csp_violation_report",
          reports,
        })
      )
    }
  } catch {
    return noStoreResponse(400)
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

import {
  healthSnapshotAgeMs,
  readPublicHealthSnapshot,
} from "@/lib/health-snapshot"
import { enforceRateLimit, getTrustedClientIp } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const ip = getTrustedClientIp(request.headers)

  if (ip) {
    const rateLimit = await enforceRateLimit({ action: "public_health", ip })

    if (!rateLimit.allowed) {
      return publicHealthResponse("degraded", rateLimit.reason === "unavailable" ? 503 : 429, {
        ...(rateLimit.retryAfterSeconds
          ? { "Retry-After": String(rateLimit.retryAfterSeconds) }
          : {}),
      })
    }
  }

  const { snapshot, source } = await readPublicHealthSnapshot()
  const snapshotAgeMs = healthSnapshotAgeMs(snapshot)

  console.info(
    JSON.stringify({
      event: "public_health_request",
      snapshotAgeMs,
      snapshotSource: source,
      status: snapshot.status,
    })
  )

  return publicHealthResponse(snapshot.status, snapshot.status === "ok" ? 200 : 503)
}

function publicHealthResponse(
  status: "degraded" | "ok" | "unavailable",
  responseStatus: number,
  extraHeaders: HeadersInit = {}
) {
  return Response.json({ status }, {
    headers: {
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
    status: responseStatus,
  })
}

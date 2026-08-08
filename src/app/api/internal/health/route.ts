import { AuthorizationError, requireFreshAdmin } from "@/lib/authorization"
import {
  healthSnapshotAgeMs,
  refreshDetailedHealthSnapshot,
} from "@/lib/health-snapshot"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await requireFreshAdmin()
    const snapshot = await refreshDetailedHealthSnapshot()

    return Response.json(
      {
        checkDurationMs: snapshot.durationMs,
        checks: snapshot.result?.checks ?? null,
        snapshotAgeMs: healthSnapshotAgeMs(snapshot),
        status: snapshot.status,
      },
      {
        headers: { "Cache-Control": "no-store" },
        status: snapshot.status === "ok" ? 200 : 503,
      }
    )
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return Response.json(
        { error: "Administrator access is required." },
        { headers: { "Cache-Control": "no-store" }, status: 403 }
      )
    }

    console.error(JSON.stringify({ event: "internal_health_route_failed" }))
    return Response.json(
      { error: "Detailed diagnostics are unavailable." },
      { headers: { "Cache-Control": "no-store" }, status: 503 }
    )
  }
}

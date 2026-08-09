import { AuthorizationError, requireFreshAdmin } from "@/lib/authorization"
import { checkSystemHealth } from "@/lib/system-health"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await requireFreshAdmin()
    const startedAt = Date.now()
    const result = await checkSystemHealth()

    return Response.json(
      {
        checkDurationMs: Math.max(0, Date.now() - startedAt),
        checks: result.checks,
        status: result.status,
      },
      {
        headers: { "Cache-Control": "no-store" },
        status: result.status === "ok" ? 200 : 503,
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

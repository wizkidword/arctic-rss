import { checkSystemHealth } from "@/lib/system-health"

export const dynamic = "force-dynamic"

export async function GET() {
  const health = await checkSystemHealth()

  return Response.json(health, {
    headers: {
      "Cache-Control": "no-store",
    },
    status: health.status === "ok" ? 200 : 503,
  })
}

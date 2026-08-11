import { handleApiV1DeviceSession } from "@/lib/api-v1/route"
import { getMobileSyncBootstrap } from "@/lib/mobile-sync"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: Request) {
  return handleApiV1DeviceSession({
    endpoint: "sync-bootstrap",
    request,
    run: async ({ userId }) => ({ data: await getMobileSyncBootstrap(userId) }),
  })
}

import { handleApiV1DeviceSession } from "@/lib/api-v1/route"
import { listMobileNotificationPreferences } from "@/lib/mobile-sync"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: Request) {
  return handleApiV1DeviceSession({
    endpoint: "notification-preferences",
    request,
    run: async ({ userId }) => ({
      data: { preferences: await listMobileNotificationPreferences(userId) },
    }),
  })
}

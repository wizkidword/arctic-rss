import { handleApiV1DeviceSession } from "@/lib/api-v1/route"
import { revokeMobileDeviceSession } from "@/lib/mobile-auth"
import { disableMobileDeviceInstallations } from "@/lib/mobile-sync"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function POST(request: Request) {
  return handleApiV1DeviceSession({
    endpoint: "device-sessions",
    request,
    run: async ({ deviceSessionId, userId }) => {
      await Promise.all([
        disableMobileDeviceInstallations({ deviceSessionId }),
        revokeMobileDeviceSession({ sessionId: deviceSessionId, userId }),
      ])
      return { data: { loggedOut: true as const } }
    },
  })
}

import {
  deviceInstallationRequestSchema,
  deviceInstallationUnregisterRequestSchema,
} from "@arctic-rss/api-contract"

import {
  handleApiV1DeviceSession,
  parseApiV1IdempotencyKey,
  parseApiV1Json,
} from "@/lib/api-v1/route"
import {
  registerMobileDeviceInstallation,
  unregisterMobileDeviceInstallation,
} from "@/lib/mobile-sync"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function PUT(request: Request) {
  return handleApiV1DeviceSession({
    endpoint: "device-installations",
    request,
    run: async ({ deviceSessionId, userId }) => {
      const body = await parseApiV1Json(request, deviceInstallationRequestSchema)
      const idempotencyKey = parseApiV1IdempotencyKey(request)
      return {
        data: await registerMobileDeviceInstallation({
          deviceSessionId,
          idempotencyKey,
          userId,
          ...body,
        }),
      }
    },
  })
}

export async function DELETE(request: Request) {
  return handleApiV1DeviceSession({
    endpoint: "device-installations",
    request,
    run: async ({ deviceSessionId }) => {
      const body = await parseApiV1Json(request, deviceInstallationUnregisterRequestSchema)
      const idempotencyKey = parseApiV1IdempotencyKey(request)
      return {
        data: await unregisterMobileDeviceInstallation({
          deviceSessionId,
          idempotencyKey,
          ...body,
        }),
      }
    },
  })
}

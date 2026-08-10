import {
  notificationPreferenceUpdateRequestSchema,
  notificationTopicSchema,
} from "@arctic-rss/api-contract"

import {
  ApiV1RouteError,
  handleApiV1DeviceSession,
  parseApiV1IdempotencyKey,
  parseApiV1Json,
} from "@/lib/api-v1/route"
import { updateMobileNotificationPreference } from "@/lib/mobile-sync"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ topic: string }> }
) {
  return handleApiV1DeviceSession({
    endpoint: "notification-preferences",
    request,
    run: async ({ deviceSessionId, userId }) => {
      const { topic: rawTopic } = await params
      const topic = notificationTopicSchema.safeParse(rawTopic)
      if (!topic.success) {
        throw new ApiV1RouteError({
          code: "REQUEST_VALIDATION_FAILED",
          issues: [{ field: "topic", message: "Provide a supported notification topic." }],
          message: "One or more request parameters are invalid.",
          retryable: false,
          status: 400,
        })
      }
      const { channel } = await parseApiV1Json(request, notificationPreferenceUpdateRequestSchema)
      const idempotencyKey = parseApiV1IdempotencyKey(request)
      return {
        data: await updateMobileNotificationPreference({
          channel,
          deviceSessionId,
          idempotencyKey,
          topic: topic.data,
          userId,
        }),
      }
    },
  })
}

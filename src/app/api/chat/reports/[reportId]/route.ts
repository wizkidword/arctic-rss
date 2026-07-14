import { requireChatEligibleUser } from "@/lib/chat/access"
import {
  parseChatReportResolutionInput,
  resolveChatReport,
} from "@/lib/chat/moderation"

import { chatNoStoreResponse, chatRouteErrorResponse } from "../../chat-response"

export const dynamic = "force-dynamic"

export async function PATCH(
  request: Request,
  context: { params: Promise<{ reportId: string }> }
) {
  try {
    const [user, body, { reportId }] = await Promise.all([
      requireChatEligibleUser({ mutationRequest: request }),
      request.json(),
      context.params,
    ])

    if (!reportId || reportId.length > 128) {
      return chatNoStoreResponse({ error: "Report ID is invalid." }, 400)
    }

    return chatNoStoreResponse(
      await resolveChatReport({
        identity: { role: user.role, userId: user.id },
        input: parseChatReportResolutionInput(body),
        reportId,
      })
    )
  } catch (error) {
    return chatRouteErrorResponse(error)
  }
}

import { requireFreshAdmin } from "@/lib/authorization"
import { assertChatMutationOrigin } from "@/lib/chat/access"
import {
  parseChatReportResolutionInput,
  resolveChatReport,
} from "@/lib/chat/moderation"
import { createChatModerationIdempotency, parseChatModerationIdempotencyKey } from "@/lib/chat/moderation-idempotency"

import { chatNoStoreResponse, chatRouteErrorResponse } from "../../chat-response"

export const dynamic = "force-dynamic"

export async function PATCH(
  request: Request,
  context: { params: Promise<{ reportId: string }> }
) {
  try {
    assertChatMutationOrigin(request)
    const [user, body, { reportId }] = await Promise.all([
      requireFreshAdmin(),
      request.json(),
      context.params,
    ])

    if (!reportId || reportId.length > 128) {
      return chatNoStoreResponse({ error: "Report ID is invalid." }, 400)
    }

    return chatNoStoreResponse(
      await resolveChatReport({
        identity: { role: user.role, userId: user.id },
        idempotency: createChatModerationIdempotency({
          action: "report:resolve",
          actorUserId: user.id,
          key: parseChatModerationIdempotencyKey(request.headers.get("Idempotency-Key")),
          request: { body, reportId },
        }),
        input: parseChatReportResolutionInput(body),
        reportId,
      })
    )
  } catch (error) {
    return chatRouteErrorResponse(error)
  }
}

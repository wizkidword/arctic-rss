import { requireChatEligibleUser } from "@/lib/chat/access"
import {
  createChatReport,
  listChatReports,
  parseChatReportInput,
} from "@/lib/chat/moderation"
import { enforceRateLimit, getRateLimitErrorMessage } from "@/lib/rate-limit"

import { chatNoStoreResponse, chatRouteErrorResponse } from "../chat-response"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const user = await requireChatEligibleUser()
    const reports = await listChatReports({
      identity: { role: user.role, userId: user.id },
    })

    return chatNoStoreResponse({ reports })
  } catch (error) {
    return chatRouteErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const [user, body] = await Promise.all([
      requireChatEligibleUser({ mutationRequest: request }),
      request.json(),
    ])
    const rateLimit = await enforceRateLimit({
      action: "chat_report",
      userId: user.id,
    })

    if (!rateLimit.allowed) {
      return chatNoStoreResponse({ error: getRateLimitErrorMessage() }, 429)
    }

    const report = await createChatReport({
      identity: { role: user.role, userId: user.id },
      input: parseChatReportInput(body),
    })

    return chatNoStoreResponse({ report }, 201)
  } catch (error) {
    return chatRouteErrorResponse(error)
  }
}

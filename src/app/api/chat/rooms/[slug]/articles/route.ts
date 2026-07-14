import { requireChatEligibleUser } from "@/lib/chat/access"
import {
  getChatRoomSnapshot,
  parseChatArticleShareInput,
  shareChatRoomArticle,
} from "@/lib/chat/room-service"
import { publishChatRoomMessage } from "@/lib/chat/room-events"
import { enforceRateLimit, getRateLimitErrorMessage } from "@/lib/rate-limit"

import { chatNoStoreResponse, chatRouteErrorResponse } from "../../../chat-response"

export const dynamic = "force-dynamic"

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const [user, { slug }, body] = await Promise.all([
      requireChatEligibleUser({ mutationRequest: request }),
      context.params,
      request.json(),
    ])
    const rateLimit = await enforceRateLimit({
      action: "chat_message",
      userId: user.id,
    })

    if (!rateLimit.allowed) {
      return chatNoStoreResponse({ error: getRateLimitErrorMessage() }, 429)
    }

    const input = parseChatArticleShareInput(body)
    const snapshot = await getChatRoomSnapshot({
      identity: { role: user.role, userId: user.id },
      limit: 1,
      slug,
    })
    const result = await shareChatRoomArticle({
      ...input,
      identity: { role: user.role, userId: user.id },
      roomId: snapshot.room.id,
    })

    // Publish retries are safe: clients de-duplicate by durable message ID.
    await publishChatRoomMessage(result.message)

    return chatNoStoreResponse(result, result.created ? 201 : 200)
  } catch (error) {
    return chatRouteErrorResponse(error)
  }
}

import { requireChatEligibleUser } from "@/lib/chat/access"
import {
  getChatRoomSnapshot,
  parseHistoryCursor,
  parseHistoryPageSize,
  parseChatTopicInput,
  updateChatRoomTopic,
} from "@/lib/chat/room-service"

import { chatNoStoreResponse, chatRouteErrorResponse } from "../../chat-response"

export const dynamic = "force-dynamic"

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const [user, { slug }] = await Promise.all([
      requireChatEligibleUser(),
      context.params,
    ])
    const url = new URL(request.url)
    const snapshot = await getChatRoomSnapshot({
      beforeSequence: parseHistoryCursor(url.searchParams.get("before")),
      identity: { role: user.role, userId: user.id },
      limit: parseHistoryPageSize(url.searchParams.get("limit")),
      slug,
    })

    return chatNoStoreResponse(snapshot)
  } catch (error) {
    return chatRouteErrorResponse(error)
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const [user, { slug }] = await Promise.all([
      requireChatEligibleUser({ mutationRequest: request }),
      context.params,
    ])
    const body = await request.json()

    const topic =
      body &&
      typeof body === "object" &&
      !Array.isArray(body) &&
      Object.keys(body).length === 1
        ? (body as { topic?: unknown }).topic
        : undefined

    return chatNoStoreResponse(
      await updateChatRoomTopic({
        identity: { role: user.role, userId: user.id },
        slug,
        topic: parseChatTopicInput(topic),
      })
    )
  } catch (error) {
    return chatRouteErrorResponse(error)
  }
}

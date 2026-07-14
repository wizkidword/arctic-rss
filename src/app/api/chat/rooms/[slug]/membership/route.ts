import { requireChatEligibleUser } from "@/lib/chat/access"
import { joinChatRoom, leaveChatRoom } from "@/lib/chat/room-service"

import { chatNoStoreResponse, chatRouteErrorResponse } from "../../../chat-response"

export const dynamic = "force-dynamic"

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const [user, { slug }] = await Promise.all([
      requireChatEligibleUser({ mutationRequest: request }),
      context.params,
    ])

    return chatNoStoreResponse(
      await joinChatRoom({ identity: { role: user.role, userId: user.id }, slug }),
      201
    )
  } catch (error) {
    return chatRouteErrorResponse(error)
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const [user, { slug }] = await Promise.all([
      requireChatEligibleUser({ mutationRequest: request }),
      context.params,
    ])

    return chatNoStoreResponse(
      await leaveChatRoom({ identity: { role: user.role, userId: user.id }, slug })
    )
  } catch (error) {
    return chatRouteErrorResponse(error)
  }
}

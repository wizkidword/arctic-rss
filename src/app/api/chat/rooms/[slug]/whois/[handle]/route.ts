import { requireChatEligibleUser } from "@/lib/chat/access"
import { getChatRoomMemberWhois } from "@/lib/chat/room-service"

import { chatNoStoreResponse, chatRouteErrorResponse } from "../../../../chat-response"

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  context: { params: Promise<{ handle: string; slug: string }> }
) {
  try {
    const [user, { handle, slug }] = await Promise.all([
      requireChatEligibleUser(),
      context.params,
    ])

    return chatNoStoreResponse(
      await getChatRoomMemberWhois({
        handle,
        identity: { role: user.role, userId: user.id },
        slug,
      })
    )
  } catch (error) {
    return chatRouteErrorResponse(error)
  }
}

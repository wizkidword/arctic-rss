import { requireChatEligibleUser } from "@/lib/chat/access"
import { ignoreChatHandle, unignoreChatHandle } from "@/lib/chat/blocks"

import { chatNoStoreResponse, chatRouteErrorResponse } from "../../chat-response"

export const dynamic = "force-dynamic"

export async function POST(
  request: Request,
  context: { params: Promise<{ handle: string }> }
) {
  try {
    const [user, { handle }] = await Promise.all([
      requireChatEligibleUser({ mutationRequest: request }),
      context.params,
    ])
    return chatNoStoreResponse(await ignoreChatHandle({ handle, userId: user.id }), 201)
  } catch (error) {
    return chatRouteErrorResponse(error)
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ handle: string }> }
) {
  try {
    const [user, { handle }] = await Promise.all([
      requireChatEligibleUser({ mutationRequest: request }),
      context.params,
    ])
    return chatNoStoreResponse(await unignoreChatHandle({ handle, userId: user.id }))
  } catch (error) {
    return chatRouteErrorResponse(error)
  }
}

import { requireChatEligibleUser } from "@/lib/chat/access"
import { publishChatBlockEvent } from "@/lib/chat/block-events"
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
    const result = await ignoreChatHandle({ handle, userId: user.id })
    await publishBlockUpdate({
      action: "blocked",
      blockedUserId: result.blockedUserId,
      blockerUserId: user.id,
    })
    return chatNoStoreResponse(result, 201)
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
    const result = await unignoreChatHandle({ handle, userId: user.id })
    await publishBlockUpdate({
      action: "unblocked",
      blockedUserId: result.blockedUserId,
      blockerUserId: user.id,
    })
    return chatNoStoreResponse(result)
  } catch (error) {
    return chatRouteErrorResponse(error)
  }
}

async function publishBlockUpdate(event: Parameters<typeof publishChatBlockEvent>[0]) {
  try {
    await publishChatBlockEvent(event)
  } catch {
    // The durable preference remains correct. A reconnect reloads it if live
    // delivery is unavailable; do not turn an already-committed block into a
    // failed user action or log user identifiers.
    console.error(JSON.stringify({ event: "chat_block_event_publish_failed" }))
  }
}

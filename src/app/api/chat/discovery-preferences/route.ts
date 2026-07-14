import { requireChatEligibleUser } from "@/lib/chat/access"
import {
  ChatProfileError,
  parsePersonalizedDiscoveryInput,
  updateChatPersonalizedDiscovery,
} from "@/lib/chat/profiles"

import { chatNoStoreResponse, chatRouteErrorResponse } from "../chat-response"

export const dynamic = "force-dynamic"

export async function PATCH(request: Request) {
  try {
    const [user, body] = await Promise.all([
      requireChatEligibleUser({ mutationRequest: request }),
      request.json(),
    ])
    const personalizedDiscovery = await updateChatPersonalizedDiscovery({
      enabled: parsePersonalizedDiscoveryInput(body),
      userId: user.id,
    })

    return chatNoStoreResponse(personalizedDiscovery)
  } catch (error) {
    if (error instanceof ChatProfileError) {
      return chatNoStoreResponse({ error: error.message }, 400)
    }

    return chatRouteErrorResponse(error)
  }
}

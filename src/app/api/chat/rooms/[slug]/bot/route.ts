import { requireChatEligibleUser } from "@/lib/chat/access"
import {
  configureChatRoomFeed,
  disableChatBotForRoom,
  listChatRoomFeedSettings,
  parseChatBotDisableInput,
  parseChatRoomFeedSettingsInput,
} from "@/lib/chat/bot"
import { enforceRateLimit, getRateLimitErrorMessage } from "@/lib/rate-limit"

import { chatNoStoreResponse, chatRouteErrorResponse } from "../../../chat-response"

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const [user, { slug }] = await Promise.all([
      requireChatEligibleUser(),
      context.params,
    ])
    const feeds = await listChatRoomFeedSettings({
      identity: { role: user.role, userId: user.id },
      roomSlug: slug,
    })

    return chatNoStoreResponse({ feeds })
  } catch (error) {
    return chatRouteErrorResponse(error)
  }
}

export async function PUT(
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
      action: "chat_moderation",
      userId: user.id,
    })
    if (!rateLimit.allowed) {
      return chatNoStoreResponse({ error: getRateLimitErrorMessage() }, 429)
    }

    const setting = await configureChatRoomFeed({
      identity: { role: user.role, userId: user.id },
      roomSlug: slug,
      settings: parseChatRoomFeedSettingsInput(body),
    })

    return chatNoStoreResponse({ setting })
  } catch (error) {
    return chatRouteErrorResponse(error)
  }
}

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
      action: "chat_moderation",
      userId: user.id,
    })
    if (!rateLimit.allowed) {
      return chatNoStoreResponse({ error: getRateLimitErrorMessage() }, 429)
    }

    parseChatBotDisableInput(body)
    return chatNoStoreResponse(
      await disableChatBotForRoom({
        identity: { role: user.role, userId: user.id },
        roomSlug: slug,
      })
    )
  } catch (error) {
    return chatRouteErrorResponse(error)
  }
}

import { requireChatEligibleUser } from "@/lib/chat/access"
import {
  banChatRoomMember,
  kickChatRoomMember,
  muteChatRoomMember,
  parseChatModerationTargetInput,
  parseChatModerationUnbanInput,
  parseChatRoomModerationSettingsInput,
  unbanChatRoomMember,
  updateChatRoomModerationSettings,
} from "@/lib/chat/moderation"
import {
  publishChatRoomClosed,
  publishChatRoomMembershipRemoved,
} from "@/lib/chat/room-events"
import { enforceRateLimit, getRateLimitErrorMessage } from "@/lib/rate-limit"

import { chatNoStoreResponse, chatRouteErrorResponse } from "../../../../chat-response"

export const dynamic = "force-dynamic"

export async function POST(
  request: Request,
  context: { params: Promise<{ action: string; slug: string }> }
) {
  try {
    const [user, { action, slug }, body] = await Promise.all([
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

    const identity = { role: user.role, userId: user.id } as const

    if (action === "kick") {
      const input = parseChatModerationTargetInput(body)
      const result = await kickChatRoomMember({
        identity,
        reason: input.reason,
        roomSlug: slug,
        targetHandle: input.targetHandle,
      })
      await publishChatRoomMembershipRemoved(result)
      return chatNoStoreResponse(result)
    }

    if (action === "ban") {
      const input = parseChatModerationTargetInput(body)
      const result = await banChatRoomMember({
        durationSeconds: input.durationSeconds,
        identity,
        reason: input.reason,
        roomSlug: slug,
        targetHandle: input.targetHandle,
      })
      await publishChatRoomMembershipRemoved(result)
      return chatNoStoreResponse(result)
    }

    if (action === "unban") {
      const input = parseChatModerationUnbanInput(body)
      return chatNoStoreResponse(
        await unbanChatRoomMember({ identity, roomSlug: slug, targetHandle: input.targetHandle })
      )
    }

    if (action === "mute") {
      const input = parseChatModerationTargetInput(body)
      if (!input.durationSeconds) {
        return chatNoStoreResponse({ error: "A mute duration is required." }, 400)
      }
      return chatNoStoreResponse(
        await muteChatRoomMember({
          durationSeconds: input.durationSeconds,
          identity,
          reason: input.reason,
          roomSlug: slug,
          targetHandle: input.targetHandle,
        })
      )
    }

    return chatNoStoreResponse({ error: "Unknown moderation action." }, 404)
  } catch (error) {
    return chatRouteErrorResponse(error)
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ action: string; slug: string }> }
) {
  try {
    const [user, { action, slug }, body] = await Promise.all([
      requireChatEligibleUser({ mutationRequest: request }),
      context.params,
      request.json(),
    ])
    if (action !== "settings") {
      return chatNoStoreResponse({ error: "Unknown moderation action." }, 404)
    }
    const rateLimit = await enforceRateLimit({
      action: "chat_moderation",
      userId: user.id,
    })

    if (!rateLimit.allowed) {
      return chatNoStoreResponse({ error: getRateLimitErrorMessage() }, 429)
    }

    const updated = await updateChatRoomModerationSettings({
      identity: { role: user.role, userId: user.id },
      roomSlug: slug,
      settings: parseChatRoomModerationSettingsInput(body),
    })
    if (updated.state === "SUSPENDED") {
      await publishChatRoomClosed({ roomId: updated.id })
    }

    return chatNoStoreResponse(updated)
  } catch (error) {
    return chatRouteErrorResponse(error)
  }
}

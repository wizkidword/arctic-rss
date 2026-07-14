import { AuthorizationError } from "@/lib/authorization"
import { ChatAccessError } from "@/lib/chat/access"
import { ChatBlockError } from "@/lib/chat/blocks"
import { ChatBotError } from "@/lib/chat/bot"
import { ChatNormalizationError } from "@/lib/chat/normalization"
import { ChatModerationError } from "@/lib/chat/moderation"
import { ChatRoomServiceError } from "@/lib/chat/room-service"

export function chatNoStoreResponse(body: unknown, status = 200) {
  return Response.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  })
}

export function chatRouteErrorResponse(error: unknown) {
  if (error instanceof AuthorizationError) {
    return chatNoStoreResponse({ error: "Authentication is required." }, 401)
  }

  if (error instanceof ChatAccessError) {
    return chatNoStoreResponse(
      { error: "Chat is not available." },
      error.code === "chat-disabled" ? 404 : 403
    )
  }

  if (error instanceof ChatRoomServiceError) {
    const status =
      error.code === "not-found"
        ? 404
        : error.code === "idempotency-conflict" || error.code === "duplicate-article"
          ? 409
          : error.code === "invalid-message" || error.code === "invalid-request"
            ? 400
          : 403

    return chatNoStoreResponse({ error: error.message }, status)
  }

  if (error instanceof ChatModerationError) {
    const status =
      error.code === "not-found"
        ? 404
        : error.code === "invalid-request"
          ? 400
          : 403

    return chatNoStoreResponse({ error: error.message }, status)
  }

  if (error instanceof ChatBlockError) {
    return chatNoStoreResponse(
      { error: error.message },
      error.code === "not-found" ? 404 : 400
    )
  }

  if (error instanceof ChatBotError) {
    const status =
      error.code === "not-found"
        ? 404
        : error.code === "invalid-request"
          ? 400
          : 403
    return chatNoStoreResponse({ error: error.message }, status)
  }

  if (error instanceof ChatNormalizationError) {
    return chatNoStoreResponse({ error: error.message }, 400)
  }

  if (error instanceof SyntaxError) {
    return chatNoStoreResponse({ error: "Request body must be valid JSON." }, 400)
  }

  console.error(JSON.stringify({ event: "chat_route_failed" }))
  return chatNoStoreResponse({ error: "Chat is temporarily unavailable." }, 500)
}

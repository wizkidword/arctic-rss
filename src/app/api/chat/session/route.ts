import { AuthorizationError } from "@/lib/authorization"
import { ChatAccessError, requireChatEligibleUser } from "@/lib/chat/access"
import { getChatProfileForUser } from "@/lib/chat/profiles"
import {
  ChatConnectionTokenError,
  getChatConnectionTokenSettings,
  issueChatConnectionToken,
} from "@/lib/chat/session-token"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const user = await requireChatEligibleUser({ mutationRequest: request })
    const profile = await getChatProfileForUser(user.id)

    if (!profile) {
      return Response.json(
        {
          code: "chat-profile-required",
          error: "Create a chat profile before connecting.",
        },
        { headers: { "Cache-Control": "no-store" }, status: 409 }
      )
    }

    const settings = getChatConnectionTokenSettings()
    const issued = issueChatConnectionToken(
      {
        authVersion: user.authVersion,
        handle: profile.handle,
        plan: user.plan,
        profileId: profile.id,
        role: user.role,
        userId: user.id,
      },
      settings
    )

    return Response.json(
      {
        expiresAt: new Date(issued.payload.exp * 1_000).toISOString(),
        token: issued.token,
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    return chatSessionErrorResponse(error)
  }
}

function chatSessionErrorResponse(error: unknown) {
  if (error instanceof AuthorizationError) {
    return Response.json(
      { error: "Authentication is required." },
      { headers: { "Cache-Control": "no-store" }, status: 401 }
    )
  }

  if (error instanceof ChatAccessError) {
    return Response.json(
      { error: "Chat is not available." },
      {
        headers: { "Cache-Control": "no-store" },
        status: error.code === "chat-disabled" ? 404 : 403,
      }
    )
  }

  if (error instanceof ChatConnectionTokenError) {
    console.error(
      JSON.stringify({
        code: error.code,
        event: "chat_session_token_configuration_failed",
      })
    )

    return Response.json(
      { error: "Chat is temporarily unavailable." },
      { headers: { "Cache-Control": "no-store" }, status: 503 }
    )
  }

  console.error(JSON.stringify({ event: "chat_session_creation_failed" }))

  return Response.json(
    { error: "Chat is temporarily unavailable." },
    { headers: { "Cache-Control": "no-store" }, status: 500 }
  )
}

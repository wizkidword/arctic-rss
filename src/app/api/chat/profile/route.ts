import { AuthorizationError } from "@/lib/authorization"
import { ChatAccessError, requireChatEligibleUser } from "@/lib/chat/access"
import {
  ChatProfileError,
  changeChatProfileHandle,
  createChatProfileForUser,
  parseChatProfileHandle,
} from "@/lib/chat/profiles"
import { ChatNormalizationError } from "@/lib/chat/normalization"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const user = await requireChatEligibleUser({ mutationRequest: request })
    const body = await request.json()
    const handle = parseChatProfileHandle(body)
    const result = await createChatProfileForUser({
      handle,
      userId: user.id,
    })

    return Response.json(
      { profile: result.profile },
      {
        headers: { "Cache-Control": "no-store" },
        status: result.created ? 201 : 200,
      }
    )
  } catch (error) {
    return chatProfileErrorResponse(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireChatEligibleUser({ mutationRequest: request })
    const body = await request.json()
    const handle = parseChatProfileHandle(body)
    const profile = await changeChatProfileHandle({ handle, userId: user.id })

    return Response.json(
      { profile },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    return chatProfileErrorResponse(error)
  }
}

function chatProfileErrorResponse(error: unknown) {
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

  if (error instanceof ChatNormalizationError || error instanceof ChatProfileError) {
    return Response.json(
      { error: error.message },
      { headers: { "Cache-Control": "no-store" }, status: 400 }
    )
  }

  if (error instanceof SyntaxError) {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { headers: { "Cache-Control": "no-store" }, status: 400 }
    )
  }

  console.error(JSON.stringify({ event: "chat_profile_creation_failed" }))

  return Response.json(
    { error: "Unable to create a chat profile." },
    { headers: { "Cache-Control": "no-store" }, status: 500 }
  )
}

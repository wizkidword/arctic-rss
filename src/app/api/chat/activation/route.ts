import { AuthorizationError } from "@/lib/authorization"
import { ChatAccessError, requireChatEligibleUser } from "@/lib/chat/access"
import {
  acceptChatPolicy,
  ChatPolicyAcceptanceError,
  parseChatPolicyAcceptance,
} from "@/lib/chat/policy-acceptance"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const user = await requireChatEligibleUser({
      mutationRequest: request,
      requirePolicyAcceptance: false,
    })
    parseChatPolicyAcceptance(await request.json())
    await acceptChatPolicy({ userId: user.id })

    return Response.json({ accepted: true }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
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

    if (error instanceof SyntaxError) {
      return Response.json(
        { error: "Request body must be valid JSON." },
        { headers: { "Cache-Control": "no-store" }, status: 400 }
      )
    }

    if (error instanceof ChatPolicyAcceptanceError) {
      return Response.json(
        { error: error.message },
        { headers: { "Cache-Control": "no-store" }, status: 400 }
      )
    }

    console.error(JSON.stringify({ event: "chat_policy_acceptance_failed" }))
    return Response.json(
      { error: "Unable to save the ArcticIRC activation confirmation." },
      { headers: { "Cache-Control": "no-store" }, status: 500 }
    )
  }
}

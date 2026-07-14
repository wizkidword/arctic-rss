import { AuthorizationError, requireFreshAdmin } from "@/lib/authorization"
import { getAppOrigin } from "@/lib/app-origin"
import {
  ChatLegalHoldError,
  createChatLegalHold,
  listActiveChatLegalHolds,
  parseCreateChatLegalHoldInput,
} from "@/lib/chat/legal-holds"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const admin = await requireFreshAdmin()
    const holds = await listActiveChatLegalHolds({
      identity: { role: admin.role, userId: admin.id },
    })

    return noStore({ holds })
  } catch (error) {
    return legalHoldErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const [admin, body] = await Promise.all([requireFreshAdmin(), request.json()])
    const hold = await createChatLegalHold({
      identity: { role: admin.role, userId: admin.id },
      input: parseCreateChatLegalHoldInput(body),
    })

    return noStore({ hold }, 201)
  } catch (error) {
    return legalHoldErrorResponse(error)
  }
}

export function noStore(body: unknown, status = 200) {
  return Response.json(body, { headers: { "Cache-Control": "no-store" }, status })
}

export function assertSameOrigin(request: Request) {
  if (request.headers.get("origin") !== getAppOrigin().origin) {
    throw new ChatLegalHoldError(
      "Legal hold changes must use the application origin.",
      "forbidden"
    )
  }
}

export function legalHoldErrorResponse(error: unknown) {
  if (error instanceof AuthorizationError) {
    return noStore({ error: "Administrator access is required." }, 403)
  }

  if (error instanceof ChatLegalHoldError) {
    return noStore(
      { error: error.message },
      error.code === "not-found" ? 404 : error.code === "invalid-request" ? 400 : 403
    )
  }

  if (error instanceof SyntaxError) {
    return noStore({ error: "Request body must be valid JSON." }, 400)
  }

  console.error(JSON.stringify({ event: "chat_legal_hold_route_failed" }))
  return noStore({ error: "Unable to process the legal hold." }, 500)
}

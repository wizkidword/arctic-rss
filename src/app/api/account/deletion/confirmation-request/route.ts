import { AuthorizationError, requireFreshUser } from "@/lib/authorization"
import {
  AccountDeletionError,
  parseOAuthAccountDeletionConfirmationRequest,
  requestOAuthAccountDeletionConfirmation,
} from "@/lib/account-deletion"
import { getAppOrigin } from "@/lib/app-origin"
import { enforceRateLimit, getTrustedClientIp } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

const noStore = { "Cache-Control": "no-store" }

export async function POST(request: Request) {
  try {
    if (request.headers.get("origin") !== getAppOrigin().origin) {
      return Response.json(
        { error: "Account deletion requests must use the application origin." },
        { headers: noStore, status: 403 }
      )
    }

    const [user, body] = await Promise.all([requireFreshUser(), request.json()])
    parseOAuthAccountDeletionConfirmationRequest(body)
    const rateLimit = await enforceRateLimit({
      action: "account_deletion_confirmation_request",
      ip: getTrustedClientIp(request.headers),
      userId: user.id,
    })

    if (!rateLimit.allowed) {
      return Response.json(
        { error: "Too many confirmation email requests. Please try again later." },
        {
          headers: {
            ...noStore,
            ...(rateLimit.retryAfterSeconds
              ? { "Retry-After": String(rateLimit.retryAfterSeconds) }
              : {}),
          },
          status: 429,
        }
      )
    }

    await requestOAuthAccountDeletionConfirmation({ userId: user.id })
    return Response.json({ requested: true }, { headers: noStore })
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return Response.json({ error: "Authentication is required." }, { headers: noStore, status: 401 })
    }

    if (error instanceof SyntaxError) {
      return Response.json(
        { error: "Request body must be valid JSON." },
        { headers: noStore, status: 400 }
      )
    }

    if (error instanceof AccountDeletionError) {
      return Response.json({ error: error.message }, { headers: noStore, status: 400 })
    }

    console.error(JSON.stringify({ event: "account_deletion_confirmation_request_failed" }))
    return Response.json(
      { error: "Unable to request the account deletion confirmation email." },
      { headers: noStore, status: 500 }
    )
  }
}

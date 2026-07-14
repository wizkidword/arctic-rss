import { AuthorizationError, requireFreshUser } from "@/lib/authorization"
import {
  AccountDeletionError,
  deleteAccount,
  parseAccountDeletionConfirmation,
  requireAccountDeletionReauthentication,
} from "@/lib/account-deletion"
import { getAppOrigin } from "@/lib/app-origin"
import { enforceRateLimit, getTrustedClientIp } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    if (request.headers.get("origin") !== getAppOrigin().origin) {
      return Response.json(
        { error: "Account deletion requests must use the application origin." },
        { headers: { "Cache-Control": "no-store" }, status: 403 }
      )
    }

    const [user, body] = await Promise.all([requireFreshUser(), request.json()])
    const { currentPassword } = parseAccountDeletionConfirmation(body)
    const rateLimit = await enforceRateLimit({
      action: "account_deletion_reauthentication",
      ip: getTrustedClientIp(request.headers),
      userId: user.id,
    })
    if (!rateLimit.allowed) {
      return Response.json(
        { error: "Too many deletion confirmation attempts. Please try again later." },
        {
          headers: {
            "Cache-Control": "no-store",
            ...(rateLimit.retryAfterSeconds
              ? { "Retry-After": String(rateLimit.retryAfterSeconds) }
              : {}),
          },
          status: 429,
        }
      )
    }

    const { authVersion } = await requireAccountDeletionReauthentication({
      currentPassword,
      userId: user.id,
    })
    await deleteAccount({ expectedAuthVersion: authVersion, userId: user.id })

    return Response.json({ deleted: true }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return Response.json(
        { error: "Authentication is required." },
        { headers: { "Cache-Control": "no-store" }, status: 401 }
      )
    }

    if (error instanceof SyntaxError) {
      return Response.json(
        { error: "Request body must be valid JSON." },
        { headers: { "Cache-Control": "no-store" }, status: 400 }
      )
    }

    if (error instanceof AccountDeletionError) {
      return Response.json(
        { error: error.message },
        { headers: { "Cache-Control": "no-store" }, status: 400 }
      )
    }

    console.error(JSON.stringify({ event: "account_deletion_failed" }))
    return Response.json(
      { error: "Unable to delete the account." },
      { headers: { "Cache-Control": "no-store" }, status: 500 }
    )
  }
}

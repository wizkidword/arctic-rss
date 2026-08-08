import { AuthorizationError, requireFreshUser } from "@/lib/authorization"
import {
  AccountDeletionError,
  confirmOAuthAccountDeletionByTokenHash,
  parseOAuthAccountDeletionFinalConfirmation,
} from "@/lib/account-deletion"
import {
  ACCOUNT_DELETION_HANDOFF_COOKIE,
  AccountDeletionHandoffError,
  clearAccountDeletionHandoffCookie,
  getAccountDeletionHandoffSecret,
  getCookieValue,
  verifyAccountDeletionHandoff,
} from "@/lib/account-deletion-handoff"
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
    parseOAuthAccountDeletionFinalConfirmation(body)
    const handoff = getCookieValue(
      request.headers.get("cookie"),
      ACCOUNT_DELETION_HANDOFF_COOKIE
    )

    if (!handoff) {
      throw new AccountDeletionHandoffError("Account deletion confirmation is invalid or expired.")
    }

    const { tokenHash } = verifyAccountDeletionHandoff(handoff, {
      secret: getAccountDeletionHandoffSecret(),
    })
    const rateLimit = await enforceRateLimit({
      action: "account_deletion_confirmation",
      ip: getTrustedClientIp(request.headers),
      userId: user.id,
    })

    if (!rateLimit.allowed) {
      return Response.json(
        { error: "Too many deletion confirmation attempts. Please try again later." },
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

    await confirmOAuthAccountDeletionByTokenHash({ tokenHash, userId: user.id })
    return Response.json(
      { deleted: true },
      { headers: { ...noStore, "Set-Cookie": clearAccountDeletionHandoffCookie() } }
    )
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
      return Response.json(
        { error: error.message },
        { headers: { ...noStore, "Set-Cookie": clearAccountDeletionHandoffCookie() }, status: 400 }
      )
    }

    if (error instanceof AccountDeletionHandoffError) {
      return Response.json(
        { error: error.message },
        { headers: { ...noStore, "Set-Cookie": clearAccountDeletionHandoffCookie() }, status: 400 }
      )
    }

    console.error(JSON.stringify({ event: "account_deletion_confirmation_failed" }))
    return Response.json(
      { error: "Unable to delete the account." },
      { headers: noStore, status: 500 }
    )
  }
}

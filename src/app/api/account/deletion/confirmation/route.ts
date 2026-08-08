import { AuthorizationError, requireFreshUser } from "@/lib/authorization"
import {
  AccountDeletionError,
  confirmOAuthAccountDeletionByTokenHash,
  parseOAuthAccountDeletionFinalConfirmation,
} from "@/lib/account-deletion"
import {
  ACCOUNT_DELETION_HANDOFF_COOKIE,
  ACCOUNT_DELETION_HANDOFF_MAX_COOKIE_BYTES,
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
const MAX_CONFIRMATION_BODY_BYTES = 1_024

export async function POST(request: Request) {
  try {
    if (request.headers.get("origin") !== getAppOrigin().origin) {
      return Response.json(
        { error: "Account deletion requests must use the application origin." },
        { headers: noStore, status: 403 }
      )
    }

    const user = await requireFreshUser()
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

    const body = await parseBoundedJson(request)
    parseOAuthAccountDeletionFinalConfirmation(body)
    const handoff = getCookieValue(
      request.headers.get("cookie"),
      ACCOUNT_DELETION_HANDOFF_COOKIE
    )

    if (!handoff || Buffer.byteLength(handoff, "utf8") > ACCOUNT_DELETION_HANDOFF_MAX_COOKIE_BYTES) {
      throw new AccountDeletionHandoffError("Account deletion confirmation is invalid or expired.")
    }

    const { tokenHash } = await verifyAccountDeletionHandoff(handoff, {
      secret: getAccountDeletionHandoffSecret(),
    })

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

async function parseBoundedJson(request: Request) {
  const contentLength = request.headers.get("content-length")
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > MAX_CONFIRMATION_BODY_BYTES) {
    throw new AccountDeletionHandoffError("Account deletion confirmation is invalid or expired.")
  }

  const body = await request.text()
  if (Buffer.byteLength(body, "utf8") > MAX_CONFIRMATION_BODY_BYTES) {
    throw new AccountDeletionHandoffError("Account deletion confirmation is invalid or expired.")
  }

  return JSON.parse(body)
}

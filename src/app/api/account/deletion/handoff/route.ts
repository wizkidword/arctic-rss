import {
  AccountDeletionError,
  getOAuthAccountDeletionHandoff,
  parseOAuthAccountDeletionHandoff,
} from "@/lib/account-deletion"
import {
  createAccountDeletionHandoff,
  clearAccountDeletionHandoffCookie,
  getAccountDeletionHandoffSecret,
  makeAccountDeletionHandoffCookie,
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

    const { token } = parseOAuthAccountDeletionHandoff(await request.json())
    const rateLimit = await enforceRateLimit({
      action: "account_deletion_handoff",
      ip: getTrustedClientIp(request.headers),
      token,
    })

    if (!rateLimit.allowed) {
      return Response.json(
        { error: "Too many deletion handoff attempts. Please try again later." },
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

    const { expiresAt, tokenHash } = await getOAuthAccountDeletionHandoff({ token })
    const handoff = createAccountDeletionHandoff(
      { expiresAt, tokenHash },
      { secret: getAccountDeletionHandoffSecret() }
    )

    return Response.json(
      { ready: true },
      { headers: { ...noStore, "Set-Cookie": makeAccountDeletionHandoffCookie(handoff, { expiresAt }) } }
    )
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json(
        { error: "Request body must be valid JSON." },
        { headers: { ...noStore, "Set-Cookie": clearAccountDeletionHandoffCookie() }, status: 400 }
      )
    }

    if (error instanceof AccountDeletionError) {
      return Response.json(
        { error: error.message },
        { headers: { ...noStore, "Set-Cookie": clearAccountDeletionHandoffCookie() }, status: 400 }
      )
    }

    console.error(JSON.stringify({ event: "account_deletion_handoff_failed" }))
    return Response.json(
      { error: "Unable to prepare account deletion confirmation." },
      { headers: { ...noStore, "Set-Cookie": clearAccountDeletionHandoffCookie() }, status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  if (request.headers.get("origin") !== getAppOrigin().origin) {
    return Response.json(
      { error: "Account deletion requests must use the application origin." },
      { headers: noStore, status: 403 }
    )
  }

  return Response.json(
    { cancelled: true },
    { headers: { ...noStore, "Set-Cookie": clearAccountDeletionHandoffCookie() } }
  )
}

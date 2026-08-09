import { AuthorizationError, requireFreshUser } from "@/lib/authorization"
import {
  AccountExportError,
  buildAccountExport,
  serializeAccountExport,
} from "@/lib/account-export"
import { enforceRateLimit, getTrustedClientIp } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const revalidate = 0

const noStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
}

export async function GET(request: Request) {
  let userId: string

  try {
    userId = (await requireFreshUser()).id
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return Response.json(
        { error: "Authentication is required." },
        { headers: noStoreHeaders, status: 401 }
      )
    }

    throw error
  }

  let rateLimit

  try {
    rateLimit = await enforceRateLimit({
      action: "account_export",
      ip: getTrustedClientIp(request.headers),
      userId,
    })
  } catch {
    return accountExportRateLimitUnavailableResponse()
  }

  if (!rateLimit.allowed) {
    if (rateLimit.reason === "unavailable") {
      return accountExportRateLimitUnavailableResponse()
    }

    return Response.json(
      { error: "Too many account export requests. Please try again later." },
      {
        headers: {
          ...noStoreHeaders,
          ...(rateLimit.retryAfterSeconds
            ? { "Retry-After": String(rateLimit.retryAfterSeconds) }
            : {}),
        },
        status: 429,
      }
    )
  }

  try {
    const accountExport = await buildAccountExport({ userId })
    const body = serializeAccountExport(accountExport)

    return new Response(body, {
      headers: {
        ...noStoreHeaders,
        "Content-Disposition": 'attachment; filename="arctic-rss-account-export.json"',
        "Content-Type": "application/json; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    if (error instanceof AccountExportError) {
      return Response.json(
        { error: error.message },
        { headers: noStoreHeaders, status: 422 }
      )
    }

    console.error(JSON.stringify({ event: "account_export_failed" }))
    return Response.json(
      { error: "Unable to create your account export." },
      { headers: noStoreHeaders, status: 500 }
    )
  }
}

function accountExportRateLimitUnavailableResponse() {
  return Response.json(
    { error: "Account export is temporarily unavailable. Please try again later." },
    { headers: noStoreHeaders, status: 503 }
  )
}

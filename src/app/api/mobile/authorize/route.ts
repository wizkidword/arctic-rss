import { auth } from "@/auth"
import { AuthorizationError, requireFreshUser } from "@/lib/authorization"
import { getAppOrigin } from "@/lib/app-origin"
import { isNativeMobileAuthorizationEnabled } from "@/lib/mobile-auth-configuration"
import {
  issueDeviceAuthorizationCode,
  MobileAuthError,
  parseBrowserDeviceAuthorizationRequest,
} from "@/lib/mobile-auth"
import { enforceRateLimit, getTrustedClientIp } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

const noStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
}

export async function GET(request: Request) {
  if (!isNativeMobileAuthorizationEnabled()) {
    return new Response(null, { headers: noStoreHeaders, status: 404 })
  }

  let authorizationRequest
  try {
    authorizationRequest = parseBrowserDeviceAuthorizationRequest(
      new URL(request.url).searchParams
    )
  } catch {
    return authorizationErrorResponse(400)
  }

  const session = await auth()
  if (!session?.user?.id || session.user.authVersion === undefined) {
    return redirectToLogin(request)
  }

  try {
    const user = await requireFreshUser(session)
    const rateLimit = await enforceRateLimit({
      action: "mobile_device_authorization",
      ip: getTrustedClientIp(request.headers),
      userId: user.id,
    })
    if (!rateLimit.allowed) {
      return authorizationErrorResponse(
        rateLimit.reason === "unavailable" ? 503 : 429,
        rateLimit.retryAfterSeconds
      )
    }

    const issued = await issueDeviceAuthorizationCode({
      authVersion: user.authVersion,
      request: authorizationRequest,
      userId: user.id,
    })
    const redirectUri = new URL(authorizationRequest.redirectUri)
    redirectUri.searchParams.set("code", issued.code)
    redirectUri.searchParams.set("state", authorizationRequest.state)

    return mobileRedirect(redirectUri)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return redirectToLogin(request)
    }
    if (error instanceof MobileAuthError) {
      return authorizationErrorResponse(400)
    }
    console.error(JSON.stringify({ event: "mobile_authorization_issue_failed" }))
    return authorizationErrorResponse(500)
  }
}

function redirectToLogin(request: Request) {
  const requestUrl = new URL(request.url)
  const login = new URL("/login", getAppOrigin())
  login.searchParams.set("callbackUrl", `${requestUrl.pathname}${requestUrl.search}`)
  return mobileRedirect(login)
}

function mobileRedirect(location: URL) {
  return new Response(null, {
    headers: { ...noStoreHeaders, Location: location.toString() },
    status: 303,
  })
}

function authorizationErrorResponse(status: 400 | 429 | 500 | 503, retryAfterSeconds?: number) {
  return Response.json(
    { error: "The mobile authorization request could not be completed." },
    {
      headers: {
        ...noStoreHeaders,
        ...(retryAfterSeconds ? { "Retry-After": String(retryAfterSeconds) } : {}),
      },
      status,
    }
  )
}

import { auth } from "@/auth"
import { AuthorizationError, requireFreshUser } from "@/lib/authorization"
import { getAppOrigin } from "@/lib/app-origin"
import { BoundedUrlEncodedFormError, readBoundedUrlEncodedForm } from "@/lib/bounded-urlencoded-form"
import { isNativeMobileAuthorizationEnabled } from "@/lib/mobile-auth-configuration"
import {
  approveMobileAuthorizationRequest,
  cancelMobileAuthorizationRequest,
  createMobileAuthorizationRequest,
  getMobileAuthorizationBrowserSessionHash,
  MobileAuthError,
  parseBrowserDeviceAuthorizationRequest,
  requireMobileAuthorizationReauthentication,
} from "@/lib/mobile-auth"
import { recordMobileAuthorizationDecision } from "@/lib/mobile-telemetry"
import { enforceRateLimit, getTrustedClientIp } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

const noStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
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
    const browserSessionHash = getMobileAuthorizationBrowserSessionHash(request.headers)
    if (!browserSessionHash) {
      return authorizationErrorResponse(400)
    }
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

    // This is intentionally only a pending, server-side request. A GET never
    // issues an authorization code or redirects credentials to a mobile app.
    const pending = await createMobileAuthorizationRequest({
      authVersion: user.authVersion,
      browserSessionHash,
      request: authorizationRequest,
      userId: user.id,
    })
    return approvalPageResponse({
      accountLabel: session.user.email ?? "your signed-in Arctic RSS account",
      approvalToken: pending.approvalToken,
      requestId: pending.id,
    })
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return redirectToLogin(request)
    }
    if (error instanceof MobileAuthError) {
      return authorizationErrorResponse(400)
    }
    console.error(JSON.stringify({ event: "mobile_authorization_request_create_failed" }))
    return authorizationErrorResponse(500)
  }
}

export async function POST(request: Request) {
  if (!isNativeMobileAuthorizationEnabled()) {
    return new Response(null, { headers: noStoreHeaders, status: 404 })
  }

  try {
    const ip = getTrustedClientIp(request.headers)
    const preBodyRateLimit = await enforceRateLimit({
      action: "mobile_device_authorization_approval_prebody",
      ip,
    })
    if (!preBodyRateLimit.allowed) {
      recordMobileAuthorizationDecision("failure")
      return authorizationErrorResponse(
        preBodyRateLimit.reason === "unavailable" ? 503 : 429,
        preBodyRateLimit.retryAfterSeconds
      )
    }
    if (!hasSameOrigin(request)) {
      recordMobileAuthorizationDecision("failure")
      return authorizationErrorResponse(400)
    }
    const form = await readBoundedUrlEncodedForm(request, {
      allowedFields: ["approval_token", "current_password", "decision", "request_id"],
    })
    const { approval_token: approvalToken, current_password: currentPassword, decision, request_id: requestId } = form
    if (
      !requestId ||
      !approvalToken ||
      (decision !== "approve" && decision !== "cancel") ||
      (decision === "approve" && !currentPassword)
    ) {
      recordMobileAuthorizationDecision("failure")
      return authorizationErrorResponse(400)
    }

    const session = await auth()
    if (!session?.user?.id || session.user.authVersion === undefined) {
      recordMobileAuthorizationDecision("failure")
      return authorizationErrorResponse(400)
    }
    const user = await requireFreshUser(session)
    const browserSessionHash = getMobileAuthorizationBrowserSessionHash(request.headers)
    if (!browserSessionHash) {
      recordMobileAuthorizationDecision("failure")
      return authorizationErrorResponse(400)
    }
    const rateLimit = await enforceRateLimit({
      action: "mobile_device_authorization_approval",
      ip,
      userId: user.id,
    })
    if (!rateLimit.allowed) {
      recordMobileAuthorizationDecision("failure")
      return authorizationErrorResponse(
        rateLimit.reason === "unavailable" ? 503 : 429,
        rateLimit.retryAfterSeconds
      )
    }
    if (decision === "approve") {
      await requireMobileAuthorizationReauthentication({
        currentPassword,
        expectedAuthVersion: user.authVersion,
        userId: user.id,
      })
    }
    const result = decision === "approve"
      ? await approveMobileAuthorizationRequest({ approvalToken, browserSessionHash, requestId, userId: user.id })
      : await cancelMobileAuthorizationRequest({ approvalToken, browserSessionHash, requestId, userId: user.id })
    recordMobileAuthorizationDecision(decision === "approve" ? "approved" : "cancelled")
    const redirectUri = new URL(result.redirectUri)
    redirectUri.searchParams.set("state", result.state)
    if (result.code) {
      redirectUri.searchParams.set("code", result.code)
    } else {
      redirectUri.searchParams.set("error", "access_denied")
    }
    return mobileRedirect(redirectUri)
  } catch (error) {
    recordMobileAuthorizationDecision("failure")
    if (
      error instanceof AuthorizationError ||
      error instanceof BoundedUrlEncodedFormError ||
      error instanceof MobileAuthError
    ) {
      return authorizationErrorResponse(400)
    }
    console.error(JSON.stringify({ event: "mobile_authorization_approval_failed" }))
    return authorizationErrorResponse(500)
  }
}

function approvalPageResponse({
  accountLabel,
  approvalToken,
  requestId,
}: {
  accountLabel: string
  approvalToken: string
  requestId: string
}) {
  const escapedAccount = escapeHtml(accountLabel)
  const escapedToken = escapeHtml(approvalToken)
  const escapedRequestId = escapeHtml(requestId)
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Authorize Arctic RSS for Android</title></head><body><main><h1>Authorize Arctic RSS for Android</h1><p>Signed in as <strong>${escapedAccount}</strong>.</p><p>Allow Arctic RSS for Android to connect to this account?</p><form method="post" action="/api/mobile/authorize"><input type="hidden" name="request_id" value="${escapedRequestId}"><input type="hidden" name="approval_token" value="${escapedToken}"><label>Current password <input autocomplete="current-password" name="current_password" required type="password"></label><button type="submit" name="decision" value="approve">Approve</button><button formnovalidate type="submit" name="decision" value="cancel">Cancel</button></form></main></body></html>`,
    {
      headers: { ...noStoreHeaders, "Content-Type": "text/html; charset=utf-8" },
      status: 200,
    }
  )
}

function hasSameOrigin(request: Request) {
  const origin = request.headers.get("origin")
  if (!origin) {
    return false
  }
  try {
    return new URL(origin).origin === getAppOrigin().origin
  } catch {
    return false
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

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character] ?? character
  ))
}

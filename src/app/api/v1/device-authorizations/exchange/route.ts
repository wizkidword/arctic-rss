import { randomUUID } from "node:crypto"

import {
  apiV1ErrorResponse,
  apiV1SuccessResponse,
} from "@/lib/api-v1/route"
import { BoundedJsonBodyError, readBoundedJsonBody } from "@/lib/api-v1/bounded-json"
import { isNativeMobileAuthorizationEnabled } from "@/lib/mobile-auth-configuration"
import {
  exchangeDeviceAuthorizationCode,
  MobileAuthError,
  parseDeviceAuthorizationExchangeRequest,
} from "@/lib/mobile-auth"
import { enforceRateLimit, getTrustedClientIp } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function POST(request: Request) {
  const requestId = randomUUID()

  if (!isNativeMobileAuthorizationEnabled()) {
    return apiV1ErrorResponse({
      code: "RESOURCE_NOT_FOUND",
      message: "Not found.",
      requestId,
      retryable: false,
      status: 404,
    })
  }

  try {
    const ip = getTrustedClientIp(request.headers)
    const preBodyRateLimit = await enforceRateLimit({
      action: "mobile_token_exchange_prebody",
      ip,
    })
    if (!preBodyRateLimit.allowed) {
      return tokenRateLimitResponse(preBodyRateLimit, requestId, "authorization")
    }

    const body = parseDeviceAuthorizationExchangeRequest(await readBoundedJsonBody(request))
    const rateLimit = await enforceRateLimit({
      action: "mobile_token_exchange",
      token: body.code,
    })
    if (!rateLimit.allowed) {
      return tokenRateLimitResponse(rateLimit, requestId, "authorization")
    }

    return apiV1SuccessResponse({
      data: await exchangeDeviceAuthorizationCode({ request: body }),
      requestId,
    })
  } catch (error) {
    if (error instanceof BoundedJsonBodyError) {
      return tokenBodyErrorResponse(error, requestId, "authorization")
    }
    if (error instanceof SyntaxError || error instanceof MobileAuthError) {
      const isConfiguration = error instanceof MobileAuthError && error.code === "configuration"
      const isDeviceLimit = error instanceof MobileAuthError && error.code === "device-limit"
      return apiV1ErrorResponse({
        code: isConfiguration
          ? "MOBILE_AUTHENTICATION_UNAVAILABLE"
          : isDeviceLimit
            ? "DEVICE_SESSION_LIMIT_REACHED"
            : "DEVICE_AUTHORIZATION_INVALID",
        message: isConfiguration
          ? "Mobile authentication is temporarily unavailable."
          : isDeviceLimit
            ? "This account already has the maximum number of mobile devices. Revoke a device first."
            : "The authorization code is invalid or expired.",
        requestId,
        retryable: isConfiguration,
        status: isConfiguration ? 503 : isDeviceLimit ? 409 : 400,
      })
    }

    console.error(JSON.stringify({ event: "mobile_authorization_exchange_failed", requestId }))
    return apiV1ErrorResponse({
      code: "INTERNAL_ERROR",
      message: "The mobile API could not complete this request.",
      requestId,
      retryable: true,
      status: 500,
    })
  }
}

function tokenRateLimitResponse(
  rateLimit: Extract<Awaited<ReturnType<typeof enforceRateLimit>>, { allowed: false }>,
  requestId: string,
  operation: "authorization" | "refresh"
) {
  return apiV1ErrorResponse({
    code: rateLimit.reason === "unavailable" ? "RATE_LIMIT_UNAVAILABLE" : "RATE_LIMITED",
    message:
      rateLimit.reason === "unavailable"
        ? "The mobile API is temporarily unavailable. Please try again later."
        : `Too many mobile ${operation} attempts. Please try again later.`,
    requestId,
    retryAfterSeconds: rateLimit.retryAfterSeconds,
    retryable: true,
    status: rateLimit.reason === "unavailable" ? 503 : 429,
  })
}

function tokenBodyErrorResponse(
  error: BoundedJsonBodyError,
  requestId: string,
  operation: "authorization" | "refresh"
) {
  if (error.code === "request-too-large") {
    return apiV1ErrorResponse({
      code: "REQUEST_TOO_LARGE",
      message: "The request body is too large.",
      requestId,
      retryable: false,
      status: 413,
    })
  }
  if (error.code === "unsupported-content-encoding" || error.code === "unsupported-media-type") {
    return apiV1ErrorResponse({
      code: "UNSUPPORTED_MEDIA_TYPE",
      message: "The request must use JSON without content encoding.",
      requestId,
      retryable: false,
      status: 415,
    })
  }
  if (error.code === "request-timeout") {
    return apiV1ErrorResponse({
      code: "REQUEST_TIMEOUT",
      message: "The request timed out.",
      requestId,
      retryable: true,
      status: 408,
    })
  }
  return apiV1ErrorResponse({
    code: "DEVICE_AUTHORIZATION_INVALID",
    message: `The ${operation} request is invalid.`,
    requestId,
    retryable: false,
    status: 400,
  })
}

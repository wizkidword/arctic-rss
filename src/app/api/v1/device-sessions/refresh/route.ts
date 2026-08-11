import { randomUUID } from "node:crypto"

import {
  apiV1ErrorResponse,
  apiV1SuccessResponse,
} from "@/lib/api-v1/route"
import { BoundedJsonBodyError, readBoundedJsonBody } from "@/lib/api-v1/bounded-json"
import {
  MobileAuthError,
  parseMobileRefreshRequest,
  refreshMobileDeviceSession,
} from "@/lib/mobile-auth"
import { enforceRateLimit, getTrustedClientIp } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function POST(request: Request) {
  const requestId = randomUUID()

  try {
    const ip = getTrustedClientIp(request.headers)
    const preBodyRateLimit = await enforceRateLimit({
      action: "mobile_token_refresh_prebody",
      ip,
    })
    if (!preBodyRateLimit.allowed) {
      return tokenRateLimitResponse(preBodyRateLimit, requestId)
    }

    const body = parseMobileRefreshRequest(await readBoundedJsonBody(request))
    const rateLimit = await enforceRateLimit({
      action: "mobile_token_refresh",
      token: body.refreshToken,
    })
    if (!rateLimit.allowed) {
      return tokenRateLimitResponse(rateLimit, requestId)
    }

    return apiV1SuccessResponse({
      data: await refreshMobileDeviceSession({ refreshToken: body.refreshToken }),
      requestId,
    })
  } catch (error) {
    if (error instanceof BoundedJsonBodyError) {
      return tokenBodyErrorResponse(error, requestId)
    }
    if (error instanceof SyntaxError || error instanceof MobileAuthError) {
      const isConfiguration = error instanceof MobileAuthError && error.code === "configuration"
      return apiV1ErrorResponse({
        code: isConfiguration ? "MOBILE_AUTHENTICATION_UNAVAILABLE" : "MOBILE_REFRESH_INVALID",
        message: isConfiguration
          ? "Mobile authentication is temporarily unavailable."
          : "The refresh token is invalid or expired.",
        requestId,
        retryable: isConfiguration,
        status: isConfiguration ? 503 : 400,
      })
    }

    console.error(JSON.stringify({ event: "mobile_refresh_failed", requestId }))
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
  requestId: string
) {
  return apiV1ErrorResponse({
    code: rateLimit.reason === "unavailable" ? "RATE_LIMIT_UNAVAILABLE" : "RATE_LIMITED",
    message:
      rateLimit.reason === "unavailable"
        ? "The mobile API is temporarily unavailable. Please try again later."
        : "Too many mobile refresh attempts. Please try again later.",
    requestId,
    retryAfterSeconds: rateLimit.retryAfterSeconds,
    retryable: true,
    status: rateLimit.reason === "unavailable" ? 503 : 429,
  })
}

function tokenBodyErrorResponse(error: BoundedJsonBodyError, requestId: string) {
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
    code: "MOBILE_REFRESH_INVALID",
    message: "The refresh request is invalid.",
    requestId,
    retryable: false,
    status: 400,
  })
}

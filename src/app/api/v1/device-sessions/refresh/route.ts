import { randomUUID } from "node:crypto"

import {
  apiV1ErrorResponse,
  apiV1SuccessResponse,
} from "@/lib/api-v1/route"
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
    const body = parseMobileRefreshRequest(await request.json())
    const rateLimit = await enforceRateLimit({
      action: "mobile_token_refresh",
      ip: getTrustedClientIp(request.headers),
      token: body.refreshToken,
    })
    if (!rateLimit.allowed) {
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

    return apiV1SuccessResponse({
      data: await refreshMobileDeviceSession({ refreshToken: body.refreshToken }),
      requestId,
    })
  } catch (error) {
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

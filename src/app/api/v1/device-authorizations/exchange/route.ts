import { randomUUID } from "node:crypto"

import {
  apiV1ErrorResponse,
  apiV1SuccessResponse,
} from "@/lib/api-v1/route"
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

  try {
    const body = parseDeviceAuthorizationExchangeRequest(await request.json())
    const rateLimit = await enforceRateLimit({
      action: "mobile_token_exchange",
      ip: getTrustedClientIp(request.headers),
      token: body.code,
    })
    if (!rateLimit.allowed) {
      return apiV1ErrorResponse({
        code: rateLimit.reason === "unavailable" ? "RATE_LIMIT_UNAVAILABLE" : "RATE_LIMITED",
        message:
          rateLimit.reason === "unavailable"
            ? "The mobile API is temporarily unavailable. Please try again later."
            : "Too many mobile authorization attempts. Please try again later.",
        requestId,
        retryAfterSeconds: rateLimit.retryAfterSeconds,
        retryable: true,
        status: rateLimit.reason === "unavailable" ? 503 : 429,
      })
    }

    return apiV1SuccessResponse({
      data: await exchangeDeviceAuthorizationCode({ request: body }),
      requestId,
    })
  } catch (error) {
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

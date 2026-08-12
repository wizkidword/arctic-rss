import { randomUUID } from "node:crypto"

import { apiV1IdentifierSchema } from "@arctic-rss/api-contract"
import type { ApiV1ErrorCode, ApiV1ValidationIssue } from "@arctic-rss/api-contract"
import type { z } from "zod"

import {
  AuthorizationError,
  requireFreshUser,
  withAuthenticatedRequestScope,
} from "@/lib/authorization"
import {
  authenticateMobileAccessToken,
  MobileAuthError,
} from "@/lib/mobile-auth"
import { MobileSyncError } from "@/lib/mobile-sync"
import { enforceRateLimit, getTrustedClientIp } from "@/lib/rate-limit"

import {
  recordApiV1Request,
  recordMobileQueueConflict,
  type ApiV1AuthMode,
  type ApiV1Endpoint,
  type ApiV1RateLimitResult,
} from "./telemetry"

const noStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
}

type ApiV1Payload<T> = {
  data: T
  nextCursor?: string | null
  pageSize?: number
}

export class ApiV1RouteError extends Error {
  readonly code: ApiV1ErrorCode
  readonly issues: ApiV1ValidationIssue[] | undefined
  readonly retryable: boolean
  readonly status: number

  constructor({
    code,
    issues,
    message,
    retryable,
    status,
  }: {
    code: ApiV1ErrorCode
    issues?: ApiV1ValidationIssue[]
    message: string
    retryable: boolean
    status: number
  }) {
    super(message)
    this.code = code
    this.issues = issues
    this.name = "ApiV1RouteError"
    this.retryable = retryable
    this.status = status
  }
}

export async function handleApiV1Read<T>({
  endpoint,
  request,
  run,
}: {
  endpoint: ApiV1Endpoint
  request: Request
  run: (context: { userId: string }) => Promise<ApiV1Payload<T>>
}): Promise<Response> {
  const requestId = randomUUID()
  const startedAt = performance.now()
  let pageSize: number | null = null
  let rateLimitResult: ApiV1RateLimitResult = "not_checked"
  let authMode: ApiV1AuthMode = "web-session"
  let response: Response

  try {
    response = await withApiV1Authentication(request, async (authentication) => {
      authMode = authentication.authMode
      let rateLimit

      try {
        rateLimit = await enforceRateLimit({
          action: "mobile_api_read",
          ip: getTrustedClientIp(request.headers),
          userId: authentication.userId,
        })
      } catch {
        rateLimitResult = "unavailable"
        return apiV1ErrorResponse({
          code: "RATE_LIMIT_UNAVAILABLE",
          message: "The mobile API is temporarily unavailable. Please try again later.",
          requestId,
          retryable: true,
          status: 503,
        })
      }

      if (!rateLimit.allowed) {
        rateLimitResult =
          rateLimit.reason === "unavailable" ? "unavailable" : "rate_limited"

        return apiV1ErrorResponse({
          code:
            rateLimit.reason === "unavailable"
              ? "RATE_LIMIT_UNAVAILABLE"
              : "RATE_LIMITED",
          message:
            rateLimit.reason === "unavailable"
              ? "The mobile API is temporarily unavailable. Please try again later."
              : "Too many mobile API requests. Please try again later.",
          requestId,
          retryAfterSeconds: rateLimit.retryAfterSeconds,
          retryable: true,
          status: rateLimit.reason === "unavailable" ? 503 : 429,
        })
      }

      rateLimitResult = "allowed"
      const payload = await run({ userId: authentication.userId })
      pageSize = payload.pageSize ?? null

      return apiV1SuccessResponse({
        data: payload.data,
        nextCursor: payload.nextCursor,
        requestId,
      })
    })
  } catch (error) {
    if (error instanceof AuthorizationError) {
      response = apiV1ErrorResponse({
        code: "AUTHENTICATION_REQUIRED",
        message: "Authentication is required.",
        requestId,
        retryable: false,
        status: 401,
      })
    } else if (error instanceof MobileAuthError) {
      response = apiV1ErrorResponse({
        code:
          error.code === "configuration"
            ? "MOBILE_AUTHENTICATION_UNAVAILABLE"
            : "AUTHENTICATION_REQUIRED",
        message:
          error.code === "configuration"
            ? "Mobile authentication is temporarily unavailable."
            : "Authentication is required.",
        requestId,
        retryable: error.code === "configuration",
        status: error.code === "configuration" ? 503 : 401,
      })
    } else if (error instanceof ApiV1RouteError) {
      response = apiV1ErrorResponse({
        code: error.code,
        issues: error.issues,
        message: error.message,
        requestId,
        retryable: error.retryable,
        status: error.status,
      })
    } else {
      console.error(
        JSON.stringify({
          endpoint,
          event: "mobile_api_v1_unhandled_error",
          requestId,
        })
      )
      response = apiV1ErrorResponse({
        code: "INTERNAL_ERROR",
        message: "The mobile API could not complete this request.",
        requestId,
        retryable: true,
        status: 500,
      })
    }
  }

  recordApiV1Request({
    authMode,
    durationMs: Math.round(performance.now() - startedAt),
    endpoint,
    pageSize,
    rateLimitResult,
    statusCode: response.status,
  })

  return response
}

export async function handleApiV1DeviceSession<T>({
  endpoint,
  request,
  run,
}: {
  endpoint: ApiV1Endpoint
  request: Request
  run: (context: { deviceSessionId: string; mobileDeviceId: string; userId: string }) => Promise<ApiV1Payload<T>>
}): Promise<Response> {
  const requestId = randomUUID()
  const startedAt = performance.now()
  let pageSize: number | null = null
  let rateLimitResult: ApiV1RateLimitResult = "not_checked"
  let response: Response

  try {
    const authorization = request.headers.get("authorization")?.trim()
    const match = authorization ? /^Bearer ([^\s]+)$/i.exec(authorization) : null
    if (!match) {
      throw new ApiV1RouteError({
        code: "MOBILE_DEVICE_SESSION_REQUIRED",
        message: "A current mobile device session is required.",
        retryable: false,
        status: 401,
      })
    }
    const principal = await authenticateMobileAccessToken({ accessToken: match[1] })
    let rateLimit: Awaited<ReturnType<typeof enforceRateLimit>>
    try {
      rateLimit = await enforceRateLimit({
        action: "mobile_api_write",
        ip: getTrustedClientIp(request.headers),
        userId: principal.userId,
      })
    } catch {
      rateLimitResult = "unavailable"
      throw new ApiV1RouteError({
        code: "RATE_LIMIT_UNAVAILABLE",
        message: "The mobile API is temporarily unavailable. Please try again later.",
        retryable: true,
        status: 503,
      })
    }

    if (!rateLimit.allowed) {
      rateLimitResult = rateLimit.reason === "unavailable" ? "unavailable" : "rate_limited"
      response = apiV1ErrorResponse({
        code: rateLimit.reason === "unavailable" ? "RATE_LIMIT_UNAVAILABLE" : "RATE_LIMITED",
        message:
          rateLimit.reason === "unavailable"
            ? "The mobile API is temporarily unavailable. Please try again later."
            : "Too many mobile API requests. Please try again later.",
        requestId,
        retryAfterSeconds: rateLimit.retryAfterSeconds,
        retryable: true,
        status: rateLimit.reason === "unavailable" ? 503 : 429,
      })
    } else {
      rateLimitResult = "allowed"
      const payload = await run({
        deviceSessionId: principal.deviceSessionId,
        mobileDeviceId: principal.mobileDeviceId,
        userId: principal.userId,
      })
      pageSize = payload.pageSize ?? null
      response = apiV1SuccessResponse({
        data: payload.data,
        nextCursor: payload.nextCursor,
        requestId,
      })
    }
  } catch (error) {
    const queueConflict = mobileQueueConflictOutcome(request, error)
    if (queueConflict) {
      recordMobileQueueConflict(queueConflict)
    }
    response = mobileApiErrorResponse({ endpoint, error, requestId })
  }

  recordApiV1Request({
    authMode: "device-session",
    durationMs: Math.round(performance.now() - startedAt),
    endpoint,
    pageSize,
    rateLimitResult,
    statusCode: response.status,
  })
  return response
}

function mobileQueueConflictOutcome(request: Request, error: unknown) {
  if (
    request.headers.get("x-arctic-rss-mutation-replay") !== "1" ||
    !(error instanceof MobileSyncError)
  ) {
    return undefined
  }
  if (error.code === "idempotency-conflict") {
    return "idempotency_key_reused" as const
  }
  if (error.code === "collection-not-found" || error.code === "resource-not-found") {
    return "resource_not_found" as const
  }
  return undefined
}

export function parseApiV1Query<T extends z.ZodType>(
  request: Request,
  schema: T
): z.output<T> {
  const values: Record<string, string> = {}

  for (const [key, value] of new URL(request.url).searchParams) {
    if (key in values) {
      throw validationError([
        { field: key, message: "Provide this query parameter only once." },
      ])
    }

    values[key] = value
  }

  const parsed = schema.safeParse(values)

  if (!parsed.success) {
    throw validationError(
      parsed.error.issues.slice(0, 5).map((issue) => ({
        field: issue.path.join(".") || "query",
        message: issue.message.slice(0, 200),
      }))
    )
  }

  return parsed.data
}

export async function parseApiV1Json<T extends z.ZodType>(request: Request, schema: T): Promise<z.output<T>> {
  let value: unknown
  try {
    value = await request.json()
  } catch {
    throw validationError([{ field: "body", message: "Provide a valid JSON request body." }])
  }
  const parsed = schema.safeParse(value)
  if (!parsed.success) {
    throw validationError(
      parsed.error.issues.slice(0, 5).map((issue) => ({
        field: issue.path.join(".") || "body",
        message: issue.message.slice(0, 200),
      }))
    )
  }
  return parsed.data
}

export function parseApiV1IdempotencyKey(request: Request) {
  const value = request.headers.get("idempotency-key")?.trim() ?? ""
  if (!/^[A-Za-z0-9._:-]{16,128}$/.test(value)) {
    throw validationError([
      {
        field: "idempotency-key",
        message: "Provide an Idempotency-Key header between 16 and 128 safe characters.",
      },
    ])
  }
  return value
}

export function parseApiV1Identifier(value: string, field: string) {
  const parsed = apiV1IdentifierSchema.safeParse(value)
  if (!parsed.success) {
    throw validationError([{ field, message: "Provide a valid resource identifier." }])
  }
  return parsed.data
}

export function apiV1NotFoundError(
  code: Extract<
    ApiV1ErrorCode,
    "ARTICLE_NOT_FOUND" | "BRIEFING_NOT_FOUND" | "PODCAST_EPISODE_NOT_FOUND"
  >,
  message: string
) {
  return new ApiV1RouteError({
    code,
    message,
    retryable: false,
    status: 404,
  })
}

function validationError(issues: ApiV1ValidationIssue[]) {
  return new ApiV1RouteError({
    code: "REQUEST_VALIDATION_FAILED",
    issues,
    message: "One or more request parameters are invalid.",
    retryable: false,
    status: 400,
  })
}

export function apiV1SuccessResponse<T>({
  data,
  nextCursor,
  requestId,
}: {
  data: T
  nextCursor?: string | null
  requestId: string
}) {
  return Response.json(
    {
      data,
      meta: {
        ...(nextCursor !== undefined ? { nextCursor } : {}),
        requestId,
      },
    },
    { headers: { ...noStoreHeaders, "X-Request-Id": requestId } }
  )
}

export function apiV1ErrorResponse({
  code,
  issues,
  message,
  requestId,
  retryAfterSeconds,
  retryable,
  status,
}: {
  code: ApiV1ErrorCode
  issues?: ApiV1ValidationIssue[]
  message: string
  requestId: string
  retryAfterSeconds?: number
  retryable: boolean
  status: number
}) {
  return Response.json(
    {
      error: {
        code,
        ...(issues?.length ? { issues } : {}),
        message,
        requestId,
        retryable,
      },
    },
    {
      headers: {
        ...noStoreHeaders,
        ...(retryAfterSeconds ? { "Retry-After": String(retryAfterSeconds) } : {}),
        "X-Request-Id": requestId,
      },
      status,
    }
  )
}

async function withApiV1Authentication<T>(
  request: Request,
  callback: (authentication: { authMode: ApiV1AuthMode; userId: string }) => Promise<T>
) {
  const authorization = request.headers.get("authorization")?.trim()

  if (authorization) {
    const match = /^Bearer ([^\s]+)$/i.exec(authorization)
    if (!match) {
      throw new AuthorizationError("Authentication is required.")
    }
    const principal = await authenticateMobileAccessToken({ accessToken: match[1] })
    return callback({ authMode: "device-session", userId: principal.userId })
  }

  return withAuthenticatedRequestScope(async (session) => {
    const user = await requireFreshUser(session)
    return callback({ authMode: "web-session", userId: user.id })
  })
}

function mobileApiErrorResponse({
  endpoint,
  error,
  requestId,
}: {
  endpoint: ApiV1Endpoint
  error: unknown
  requestId: string
}) {
  if (error instanceof MobileAuthError) {
    return apiV1ErrorResponse({
      code: error.code === "configuration" ? "MOBILE_AUTHENTICATION_UNAVAILABLE" : "AUTHENTICATION_REQUIRED",
      message:
        error.code === "configuration"
          ? "Mobile authentication is temporarily unavailable."
          : "Authentication is required.",
      requestId,
      retryable: error.code === "configuration",
      status: error.code === "configuration" ? 503 : 401,
    })
  }
  if (error instanceof ApiV1RouteError) {
    return apiV1ErrorResponse({
      code: error.code,
      issues: error.issues,
      message: error.message,
      requestId,
      retryable: error.retryable,
      status: error.status,
    })
  }
  if (error instanceof MobileSyncError) {
    const mapped = {
      "collection-not-found": { code: "COLLECTION_NOT_FOUND" as const, status: 404 },
      "full-resync-required": { code: "FULL_RESYNC_REQUIRED" as const, status: 409 },
      "idempotency-conflict": { code: "IDEMPOTENCY_KEY_REUSED" as const, status: 409 },
      "installation-conflict": { code: "DEVICE_INSTALLATION_CONFLICT" as const, status: 409 },
      "resource-not-found": { code: "RESOURCE_NOT_FOUND" as const, status: 404 },
    }[error.code]
    return apiV1ErrorResponse({
      code: mapped.code,
      message: error.message,
      requestId,
      retryable: false,
      status: mapped.status,
    })
  }
  console.error(JSON.stringify({ endpoint, event: "mobile_api_v1_unhandled_error", requestId }))
  return apiV1ErrorResponse({
    code: "INTERNAL_ERROR",
    message: "The mobile API could not complete this request.",
    requestId,
    retryable: true,
    status: 500,
  })
}

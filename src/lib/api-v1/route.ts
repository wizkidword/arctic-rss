import { randomUUID } from "node:crypto"

import type { ApiV1ErrorCode, ApiV1ValidationIssue } from "@arctic-rss/api-contract"
import type { z } from "zod"

import {
  AuthorizationError,
  requireFreshUser,
  withAuthenticatedRequestScope,
} from "@/lib/authorization"
import { enforceRateLimit, getTrustedClientIp } from "@/lib/rate-limit"

import {
  recordApiV1Request,
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
  let response: Response

  try {
    response = await withAuthenticatedRequestScope(async (session) => {
      const user = await requireFreshUser(session)
      let rateLimit

      try {
        rateLimit = await enforceRateLimit({
          action: "mobile_api_read",
          ip: getTrustedClientIp(request.headers),
          userId: user.id,
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
      const payload = await run({ userId: user.id })
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
    durationMs: Math.round(performance.now() - startedAt),
    endpoint,
    pageSize,
    rateLimitResult,
    requestId,
    statusCode: response.status,
  })

  return response
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

export function apiV1NotFoundError(
  code: Extract<ApiV1ErrorCode, "ARTICLE_NOT_FOUND" | "PODCAST_EPISODE_NOT_FOUND">,
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

function apiV1SuccessResponse<T>({
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

function apiV1ErrorResponse({
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

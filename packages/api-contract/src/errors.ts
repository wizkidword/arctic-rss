import { z } from "zod"

export const apiV1ErrorCodeSchema = z.enum([
  "ARTICLE_NOT_FOUND",
  "AUTHENTICATION_REQUIRED",
  "COLLECTION_NOT_FOUND",
  "DEVICE_INSTALLATION_CONFLICT",
  "DEVICE_AUTHORIZATION_INVALID",
  "DEVICE_SESSION_LIMIT_REACHED",
  "FULL_RESYNC_REQUIRED",
  "IDEMPOTENCY_KEY_REUSED",
  "INTERNAL_ERROR",
  "MOBILE_AUTHENTICATION_UNAVAILABLE",
  "MOBILE_DEVICE_SESSION_REQUIRED",
  "MOBILE_REFRESH_INVALID",
  "PODCAST_EPISODE_NOT_FOUND",
  "BRIEFING_NOT_FOUND",
  "RATE_LIMITED",
  "RATE_LIMIT_UNAVAILABLE",
  "RESOURCE_NOT_FOUND",
  "REQUEST_TIMEOUT",
  "REQUEST_TOO_LARGE",
  "REQUEST_VALIDATION_FAILED",
  "UNSUPPORTED_MEDIA_TYPE",
])

export const apiV1ValidationIssueSchema = z
  .object({
    field: z.string().max(100),
    message: z.string().max(200),
  })
  .strict()

export const apiV1ErrorSchema = z
  .object({
    code: apiV1ErrorCodeSchema,
    issues: z.array(apiV1ValidationIssueSchema).max(5).optional(),
    message: z.string().max(240),
    requestId: z.string().uuid(),
    retryable: z.boolean(),
  })
  .strict()

export const apiV1ErrorEnvelopeSchema = z
  .object({
    error: apiV1ErrorSchema,
  })
  .strict()

export type ApiV1ErrorCode = z.infer<typeof apiV1ErrorCodeSchema>
export type ApiV1Error = z.infer<typeof apiV1ErrorSchema>
export type ApiV1ValidationIssue = z.infer<typeof apiV1ValidationIssueSchema>

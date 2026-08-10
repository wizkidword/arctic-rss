import { z } from "zod"

export const apiV1ErrorCodeSchema = z.enum([
  "ARTICLE_NOT_FOUND",
  "AUTHENTICATION_REQUIRED",
  "DEVICE_AUTHORIZATION_INVALID",
  "DEVICE_SESSION_LIMIT_REACHED",
  "INTERNAL_ERROR",
  "MOBILE_AUTHENTICATION_UNAVAILABLE",
  "MOBILE_REFRESH_INVALID",
  "PODCAST_EPISODE_NOT_FOUND",
  "RATE_LIMITED",
  "RATE_LIMIT_UNAVAILABLE",
  "REQUEST_VALIDATION_FAILED",
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

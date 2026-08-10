import { z } from "zod"

import {
  apiV1CursorSchema,
  apiV1IdentifierSchema,
  apiV1PageSizeSchema,
  apiV1SuccessSchema,
  apiV1TimestampSchema,
} from "./common"

export const briefingSchema = z
  .object({
    articleCount: z.number().int().nonnegative(),
    completedAt: apiV1TimestampSchema.nullable(),
    createdAt: apiV1TimestampSchema,
    id: apiV1IdentifierSchema,
    status: z.enum([
      "COMPLETED",
      "COMPLETED_NO_MATCHES",
      "FAILED",
      "PENDING",
      "PROCESSING",
    ]),
    title: z.string().max(500),
  })
  .strict()

export const briefingsQuerySchema = z
  .object({
    cursor: apiV1CursorSchema.optional(),
    limit: apiV1PageSizeSchema,
  })
  .strict()

export const briefingsResponseSchema = apiV1SuccessSchema(
  z.object({ briefings: z.array(briefingSchema) }).strict()
)

export const briefingDetailSchema = briefingSchema.extend({
  emailErrorMessage: z.string().max(2_000).nullable(),
  emailStatus: z.enum(["NOT_REQUESTED", "PENDING", "DELIVERY_UNKNOWN", "SENT", "FAILED"]),
  errorMessage: z.string().max(2_000).nullable(),
  items: z
    .array(
      z
        .object({
          articleId: apiV1IdentifierSchema.nullable(),
          articleTitle: z.string().max(2_000),
          articleUrl: z.string().url(),
          feedTitle: z.string().max(500),
          id: apiV1IdentifierSchema,
          matchedTerms: z.array(z.string().max(500)).max(50),
          position: z.number().int().nonnegative(),
          publishedAt: apiV1TimestampSchema.nullable(),
          reason: z.string().max(2_000),
          summary: z.string().max(20_000),
        })
        .strict()
    )
    .max(200),
  rule: z
    .object({
      id: apiV1IdentifierSchema,
      name: z.string().max(500),
    })
    .strict(),
  topicPrompt: z.string().max(10_000),
})

export const briefingDetailResponseSchema = apiV1SuccessSchema(briefingDetailSchema)

export type Briefing = z.infer<typeof briefingSchema>
export type BriefingDetail = z.infer<typeof briefingDetailSchema>

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

export type Briefing = z.infer<typeof briefingSchema>

import { z } from "zod"

import { apiV1SuccessSchema, apiV1TimestampSchema } from "./common"

export const syncCursorSchema = z.string().regex(/^\d+$/).max(32)

export const syncQuerySchema = z
  .object({
    cursor: syncCursorSchema.optional(),
    limit: z.coerce.number().int().min(1).max(200).default(100),
  })
  .strict()

export const userSyncEventSchema = z
  .object({
    action: z.enum(["TOMBSTONE", "UPSERT"]),
    occurredAt: apiV1TimestampSchema,
    payload: z.record(z.string(), z.unknown()),
    resourceId: z.string().min(1).max(128),
    resourceType: z.string().min(1).max(64),
    resourceVersion: z.string().min(1).max(64),
    sequence: syncCursorSchema,
  })
  .strict()

export const syncResponseSchema = apiV1SuccessSchema(
  z
    .object({
      events: z.array(userSyncEventSchema),
      fullResyncRequired: z.literal(false),
    })
    .strict()
)

export type UserSyncEvent = z.infer<typeof userSyncEventSchema>

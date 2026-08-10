import { z } from "zod"

import {
  apiV1CursorSchema,
  apiV1IdentifierSchema,
  apiV1PageSizeSchema,
  apiV1SuccessSchema,
  apiV1TimestampSchema,
} from "./common"

export const savedViewSchema = z
  .object({
    collectionId: apiV1IdentifierSchema.nullable(),
    description: z.string().max(500).nullable(),
    folderId: apiV1IdentifierSchema.nullable(),
    id: apiV1IdentifierSchema,
    monitorEnabled: z.boolean(),
    monitorNewMatchCount: z.number().int().nonnegative(),
    name: z.string().max(80),
    publishedAfter: apiV1TimestampSchema.nullable(),
    publishedBefore: apiV1TimestampSchema.nullable(),
    query: z.string().max(200),
    sourceId: apiV1IdentifierSchema.nullable(),
    state: z.enum(["all", "read", "starred", "unread"]),
    updatedAt: apiV1TimestampSchema,
  })
  .strict()

export const savedViewsResponseSchema = apiV1SuccessSchema(
  z.object({ savedViews: z.array(savedViewSchema) }).strict()
)

export const savedViewsQuerySchema = z
  .object({
    cursor: apiV1CursorSchema.optional(),
    limit: apiV1PageSizeSchema,
  })
  .strict()

export type SavedView = z.infer<typeof savedViewSchema>

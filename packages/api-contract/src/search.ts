import { z } from "zod"

import {
  apiV1CursorSchema,
  apiV1IdentifierSchema,
  apiV1PageSizeSchema,
} from "./common"

const calendarDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const searchQuerySchema = z
  .object({
    collectionId: apiV1IdentifierSchema.optional(),
    cursor: apiV1CursorSchema.optional(),
    folderId: apiV1IdentifierSchema.optional(),
    from: calendarDateSchema.optional(),
    limit: apiV1PageSizeSchema,
    q: z.string().trim().max(200).default(""),
    sourceId: apiV1IdentifierSchema.optional(),
    state: z.enum(["all", "read", "starred", "unread"]).default("all"),
    to: calendarDateSchema.optional(),
  })
  .strict()

export type SearchQuery = z.infer<typeof searchQuerySchema>

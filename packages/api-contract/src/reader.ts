import { z } from "zod"

import {
  apiV1CursorSchema,
  apiV1IdentifierSchema,
  apiV1PageSizeSchema,
} from "./common"

export const readerQuerySchema = z
  .object({
    collectionId: apiV1IdentifierSchema.optional(),
    cursor: apiV1CursorSchema.optional(),
    feedId: apiV1IdentifierSchema.optional(),
    folderId: apiV1IdentifierSchema.optional(),
    limit: apiV1PageSizeSchema,
    state: z.enum(["all", "starred", "unread"]).default("all"),
  })
  .strict()

export type ReaderQuery = z.infer<typeof readerQuerySchema>

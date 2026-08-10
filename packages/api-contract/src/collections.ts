import { z } from "zod"

import { apiV1IdentifierSchema, apiV1SuccessSchema } from "./common"

export const collectionSchema = z
  .object({
    id: apiV1IdentifierSchema,
    itemCount: z.number().int().nonnegative(),
    name: z.string().max(80),
  })
  .strict()

export const collectionsResponseSchema = apiV1SuccessSchema(
  z.object({ collections: z.array(collectionSchema) }).strict()
)

export type Collection = z.infer<typeof collectionSchema>

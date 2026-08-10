import { z } from "zod"

import { apiV1IdentifierSchema, apiV1SuccessSchema } from "./common"

export const feedSchema = z
  .object({
    faviconUrl: z.string().url().nullable(),
    id: apiV1IdentifierSchema,
    isPaused: z.boolean(),
    needsAttention: z.boolean(),
    subscriptionId: apiV1IdentifierSchema,
    title: z.string().max(500),
    unreadCount: z.number().int().nonnegative(),
  })
  .strict()

export const feedsResponseSchema = apiV1SuccessSchema(
  z.object({ feeds: z.array(feedSchema) }).strict()
)

export type Feed = z.infer<typeof feedSchema>

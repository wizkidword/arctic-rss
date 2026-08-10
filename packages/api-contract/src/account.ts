import { z } from "zod"

import { apiV1IdentifierSchema, apiV1SuccessSchema } from "./common"

export const meSchema = z
  .object({
    email: z.string().email(),
    id: apiV1IdentifierSchema,
    name: z.string().max(500).nullable(),
    plan: z.enum(["ADMIN", "FREE", "PRO"]),
  })
  .strict()

export const meResponseSchema = apiV1SuccessSchema(meSchema)

export type Me = z.infer<typeof meSchema>

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

export const mobileTokenResponseDataSchema = z
  .object({
    accessToken: z.string().min(1).max(2_000),
    accessTokenExpiresIn: z.number().int().positive().max(3_600),
    refreshToken: z.string().min(1).max(512),
  })
  .strict()

export const mobileTokenResponseSchema = apiV1SuccessSchema(mobileTokenResponseDataSchema)

export type Me = z.infer<typeof meSchema>
export type MobileTokenResponseData = z.infer<typeof mobileTokenResponseDataSchema>

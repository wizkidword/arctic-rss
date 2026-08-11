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

// The native client is public but still registered. No caller-selected redirect
// URI or mobile client identifier is accepted by the exchange endpoint.
export const deviceAuthorizationExchangeRequestSchema = z
  .object({
    clientId: z.literal("android:com.arcticrss.reader"),
    code: z.string().min(32).max(512),
    codeVerifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/),
    nonce: z.string().regex(/^[A-Za-z0-9._~-]{16,256}$/),
    redirectUri: z.literal("https://arcticrss.com/mobile/auth/callback"),
  })
  .strict()

export type Me = z.infer<typeof meSchema>
export type MobileTokenResponseData = z.infer<typeof mobileTokenResponseDataSchema>

import { z } from "zod"

import {
  BCRYPT_PASSWORD_BYTE_LIMIT_MESSAGE,
  isBcryptPasswordByteLengthValid,
  PASSWORD_MINIMUM_LENGTH,
} from "@/lib/password-policy"

export type SignupInput = {
  email: string
  name: string
  password: string
}

export const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().max(80),
  password: z
    .string()
    .min(PASSWORD_MINIMUM_LENGTH)
    .max(256)
    .refine(isBcryptPasswordByteLengthValid, {
      message: BCRYPT_PASSWORD_BYTE_LIMIT_MESSAGE,
    }),
})

export function normalizeSignupInput(input: SignupInput): SignupInput {
  return {
    email: input.email.trim().toLowerCase(),
    name: input.name.trim(),
    password: input.password,
  }
}

export function validateSignupInput(input: SignupInput) {
  return signupSchema.safeParse(normalizeSignupInput(input))
}

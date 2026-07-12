import { z } from "zod"

export type SignupInput = {
  email: string
  name: string
  password: string
}

export const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().max(80),
  password: z.string().min(8).max(256),
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

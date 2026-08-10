import { z } from "zod"

export const apiV1IdentifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/)

export const apiV1CursorSchema = z.string().min(1).max(512)

export const apiV1PageSizeSchema = z.coerce.number().int().min(1).max(50).default(30)

export const apiV1TimestampSchema = z.string().datetime()

export const apiV1MetaSchema = z
  .object({
    nextCursor: apiV1CursorSchema.nullable().optional(),
    requestId: z.string().uuid(),
  })
  .strict()

export function apiV1SuccessSchema<T extends z.ZodType>(data: T) {
  return z
    .object({
      data,
      meta: apiV1MetaSchema,
    })
    .strict()
}

export type ApiV1Meta = z.infer<typeof apiV1MetaSchema>
export type ApiV1Success<T> = {
  data: T
  meta: ApiV1Meta
}

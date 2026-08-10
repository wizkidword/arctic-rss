import { z } from "zod"

import { apiV1IdentifierSchema, apiV1SuccessSchema, apiV1TimestampSchema } from "./common"

export const apiV1IdempotencyKeySchema = z
  .string()
  .trim()
  .min(16)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/)

export const articleStateMutationRequestSchema = z
  .object({
    isArchived: z.boolean().optional(),
    isRead: z.boolean().optional(),
    isStarred: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) => value.isArchived !== undefined || value.isRead !== undefined || value.isStarred !== undefined,
    "Provide at least one article state value."
  )

export const articleStateMutationResultSchema = z
  .object({
    archivedAt: apiV1TimestampSchema.nullable(),
    articleId: apiV1IdentifierSchema,
    isRead: z.boolean(),
    isStarred: z.boolean(),
    readAt: apiV1TimestampSchema.nullable(),
    replayed: z.boolean(),
    starredAt: apiV1TimestampSchema.nullable(),
  })
  .strict()

export const articleStateMutationResponseSchema = apiV1SuccessSchema(
  articleStateMutationResultSchema
)

export const collectionItemRequestSchema = z
  .object({ articleId: apiV1IdentifierSchema })
  .strict()

export const collectionItemMutationResultSchema = z
  .object({
    articleId: apiV1IdentifierSchema,
    collectionId: apiV1IdentifierSchema,
    replayed: z.boolean(),
    removed: z.boolean(),
  })
  .strict()

export const collectionItemMutationResponseSchema = apiV1SuccessSchema(
  collectionItemMutationResultSchema
)

export const podcastProgressMutationRequestSchema = z
  .object({ playbackPositionSeconds: z.number().int().min(0).max(604_800) })
  .strict()

export const podcastStateMutationRequestSchema = z
  .object({
    isPlayed: z.boolean().optional(),
    isStarred: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) => value.isPlayed !== undefined || value.isStarred !== undefined,
    "Provide at least one podcast episode state value."
  )

export const podcastEpisodeStateMutationResultSchema = z
  .object({
    episodeId: apiV1IdentifierSchema,
    isPlayed: z.boolean(),
    isStarred: z.boolean(),
    playedAt: apiV1TimestampSchema.nullable(),
    playbackPositionSeconds: z.number().int().nonnegative(),
    replayed: z.boolean(),
    starredAt: apiV1TimestampSchema.nullable(),
  })
  .strict()

export const podcastEpisodeStateMutationResponseSchema = apiV1SuccessSchema(
  podcastEpisodeStateMutationResultSchema
)

export const deviceSessionLogoutResultSchema = z
  .object({ loggedOut: z.literal(true) })
  .strict()

export const deviceSessionLogoutResponseSchema = apiV1SuccessSchema(
  deviceSessionLogoutResultSchema
)

export type ArticleStateMutationRequest = z.infer<typeof articleStateMutationRequestSchema>
export type PodcastProgressMutationRequest = z.infer<typeof podcastProgressMutationRequestSchema>
export type PodcastStateMutationRequest = z.infer<typeof podcastStateMutationRequestSchema>

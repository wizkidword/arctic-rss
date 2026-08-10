import { z } from "zod"

import {
  apiV1CursorSchema,
  apiV1IdentifierSchema,
  apiV1PageSizeSchema,
  apiV1SuccessSchema,
  apiV1TimestampSchema,
} from "./common"

export const podcastEpisodeSchema = z
  .object({
    audioType: z.string().max(255).nullable(),
    audioUrl: z.string().url(),
    description: z.string().max(100_000).nullable(),
    durationSeconds: z.number().int().nonnegative().nullable(),
    id: apiV1IdentifierSchema,
    imageUrl: z.string().url().nullable(),
    isPlayed: z.boolean(),
    isStarred: z.boolean(),
    playbackPositionSeconds: z.number().int().nonnegative(),
    podcast: z
      .object({
        id: apiV1IdentifierSchema,
        title: z.string().max(500),
      })
      .strict(),
    publishedAt: apiV1TimestampSchema.nullable(),
    title: z.string().max(2_000),
    url: z.string().url().nullable(),
  })
  .strict()

export const podcastEpisodeDetailSchema = podcastEpisodeSchema.extend({
  contentText: z.string().max(2_000_000).nullable(),
})

export const podcastSchema = z
  .object({
    artworkUrl: z.string().url().nullable(),
    id: apiV1IdentifierSchema,
    latestEpisodeTitle: z.string().max(2_000).nullable(),
    subscriptionId: apiV1IdentifierSchema,
    title: z.string().max(500),
    unplayedCount: z.number().int().nonnegative(),
  })
  .strict()

export const podcastsQuerySchema = z
  .object({
    cursor: apiV1CursorSchema.optional(),
    limit: apiV1PageSizeSchema,
  })
  .strict()

export const podcastsResponseSchema = apiV1SuccessSchema(
  z
    .object({
      episodes: z.array(podcastEpisodeSchema),
      podcasts: z.array(podcastSchema),
    })
    .strict()
)

export const podcastEpisodeResponseSchema = apiV1SuccessSchema(
  podcastEpisodeDetailSchema
)

export type PodcastEpisode = z.infer<typeof podcastEpisodeSchema>
export type PodcastEpisodeDetail = z.infer<typeof podcastEpisodeDetailSchema>

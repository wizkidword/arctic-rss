import { z } from "zod"

import {
  apiV1IdentifierSchema,
  apiV1SuccessSchema,
  apiV1TimestampSchema,
} from "./common"
import { notificationChannelSchema, notificationTopicSchema } from "./notifications"

export const syncCursorSchema = z.string().regex(/^\d+$/).max(32)

export const syncQuerySchema = z
  .object({
    cursor: syncCursorSchema.optional(),
    limit: z.coerce.number().int().min(1).max(200).default(100),
  })
  .strict()

const syncEventBaseSchema = z
  .object({
    occurredAt: apiV1TimestampSchema,
    resourceId: apiV1IdentifierSchema,
    resourceVersion: z.string().min(1).max(64),
    schemaVersion: z.literal(1),
    sequence: syncCursorSchema,
  })
  .strict()

const articleStatePayloadSchema = z
  .object({
    archivedAt: apiV1TimestampSchema.nullable(),
    articleId: apiV1IdentifierSchema,
    isRead: z.boolean(),
    isStarred: z.boolean(),
    readAt: apiV1TimestampSchema.nullable(),
    starredAt: apiV1TimestampSchema.nullable(),
  })
  .strict()

const collectionItemPayloadSchema = z
  .object({
    articleId: apiV1IdentifierSchema.optional(),
    collectionId: apiV1IdentifierSchema,
    itemId: apiV1IdentifierSchema,
    podcastEpisodeId: apiV1IdentifierSchema.optional(),
  })
  .strict()
  .refine((payload) => payload.articleId !== undefined || payload.podcastEpisodeId !== undefined, {
    message: "Collection item events require an article or podcast episode reference.",
  })

const podcastEpisodeStatePayloadSchema = z
  .object({
    episodeId: apiV1IdentifierSchema,
    isPlayed: z.boolean(),
    isStarred: z.boolean(),
    playedAt: apiV1TimestampSchema.nullable(),
    playbackPositionSeconds: z.number().int().nonnegative(),
    starredAt: apiV1TimestampSchema.nullable(),
  })
  .strict()

const event = <T extends z.ZodType>(resourceType: string, action: "TOMBSTONE" | "UPSERT", payload: T) =>
  syncEventBaseSchema.extend({
    action: z.literal(action),
    payload,
    resourceType: z.literal(resourceType),
  })

export const userSyncEventSchema = z.union([
  event("article-state", "UPSERT", articleStatePayloadSchema),
  event("article-state", "TOMBSTONE", z.object({ articleId: apiV1IdentifierSchema }).strict()),
  event(
    "collection",
    "UPSERT",
    z
      .object({
        collectionId: apiV1IdentifierSchema,
        name: z.string().min(1).max(80),
        sortOrder: z.number().int().nonnegative(),
      })
      .strict()
  ),
  event("collection", "TOMBSTONE", z.object({ collectionId: apiV1IdentifierSchema }).strict()),
  event("collection-item", "UPSERT", collectionItemPayloadSchema),
  event("collection-item", "TOMBSTONE", collectionItemPayloadSchema),
  event("podcast-episode-state", "UPSERT", podcastEpisodeStatePayloadSchema),
  event("podcast-episode-state", "TOMBSTONE", z.object({ episodeId: apiV1IdentifierSchema }).strict()),
  event("saved-view", "UPSERT", z.object({ id: apiV1IdentifierSchema }).strict()),
  event("saved-view", "TOMBSTONE", z.object({ id: apiV1IdentifierSchema }).strict()),
  event(
    "feed-subscription",
    "UPSERT",
    z.object({ feedId: apiV1IdentifierSchema, subscriptionId: apiV1IdentifierSchema }).strict()
  ),
  event(
    "feed-subscription",
    "TOMBSTONE",
    z.object({ feedId: apiV1IdentifierSchema, subscriptionId: apiV1IdentifierSchema }).strict()
  ),
  event(
    "podcast-subscription",
    "UPSERT",
    z.object({ podcastId: apiV1IdentifierSchema, subscriptionId: apiV1IdentifierSchema }).strict()
  ),
  event(
    "podcast-subscription",
    "TOMBSTONE",
    z.object({ podcastId: apiV1IdentifierSchema, subscriptionId: apiV1IdentifierSchema }).strict()
  ),
  event("briefing", "UPSERT", z.object({ id: apiV1IdentifierSchema }).strict()),
  event("briefing", "TOMBSTONE", z.object({ id: apiV1IdentifierSchema }).strict()),
  event(
    "notification-preference",
    "UPSERT",
    z.object({ channel: notificationChannelSchema, topic: notificationTopicSchema }).strict()
  ),
  event(
    "notification-preference",
    "TOMBSTONE",
    z.object({ channel: notificationChannelSchema, topic: notificationTopicSchema }).strict()
  ),
])

export const syncResponseSchema = apiV1SuccessSchema(
  z
    .object({
      events: z.array(userSyncEventSchema).max(200),
      fullResyncRequired: z.literal(false),
      hasMore: z.boolean(),
    })
    .strict()
)

export type UserSyncEvent = z.infer<typeof userSyncEventSchema>

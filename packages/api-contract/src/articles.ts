import { z } from "zod"

import {
  apiV1IdentifierSchema,
  apiV1SuccessSchema,
  apiV1TimestampSchema,
} from "./common"

export const articleListItemSchema = z
  .object({
    collectionRetention: z
      .object({
        savedAt: apiV1TimestampSchema,
        sourceIsFollowed: z.boolean(),
      })
      .strict()
      .optional(),
    feed: z
      .object({
        faviconUrl: z.string().url().nullable(),
        id: apiV1IdentifierSchema,
        title: z.string().max(500),
      })
      .strict(),
    id: apiV1IdentifierSchema,
    imageUrl: z.string().url().nullable(),
    isRead: z.boolean(),
    isStarred: z.boolean(),
    publishedAt: apiV1TimestampSchema.nullable(),
    summary: z.string().max(20_000).nullable(),
    title: z.string().max(2_000),
    url: z.string().url(),
  })
  .strict()

export const articleDetailSchema = articleListItemSchema.extend({
  author: z.string().max(500).nullable(),
  contentHtml: z.string().max(2_000_000).nullable(),
  contentText: z.string().max(2_000_000).nullable(),
  readAt: apiV1TimestampSchema.nullable(),
  starredAt: apiV1TimestampSchema.nullable(),
})

export const readerPageDataSchema = z
  .object({
    articles: z.array(articleListItemSchema),
  })
  .strict()

export const readerPageResponseSchema = apiV1SuccessSchema(readerPageDataSchema)
export const articleDetailResponseSchema = apiV1SuccessSchema(articleDetailSchema)

export type ArticleListItem = z.infer<typeof articleListItemSchema>
export type ArticleDetail = z.infer<typeof articleDetailSchema>

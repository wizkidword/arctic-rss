import { z } from "zod"

import { meResponseSchema } from "./account"
import { articleDetailResponseSchema, readerPageResponseSchema } from "./articles"
import { briefingsResponseSchema } from "./briefings"
import { collectionsResponseSchema } from "./collections"
import { apiV1ErrorEnvelopeSchema } from "./errors"
import { feedsResponseSchema } from "./feeds"
import { podcastEpisodeResponseSchema, podcastsResponseSchema } from "./podcasts"
import { savedViewsResponseSchema } from "./saved-views"

const schemas = {
  ApiV1Error: z.toJSONSchema(apiV1ErrorEnvelopeSchema, { target: "draft-2020-12" }),
  ArticleDetailResponse: z.toJSONSchema(articleDetailResponseSchema, {
    target: "draft-2020-12",
  }),
  BriefingsResponse: z.toJSONSchema(briefingsResponseSchema, {
    target: "draft-2020-12",
  }),
  CollectionsResponse: z.toJSONSchema(collectionsResponseSchema, {
    target: "draft-2020-12",
  }),
  FeedsResponse: z.toJSONSchema(feedsResponseSchema, { target: "draft-2020-12" }),
  MeResponse: z.toJSONSchema(meResponseSchema, { target: "draft-2020-12" }),
  PodcastEpisodeResponse: z.toJSONSchema(podcastEpisodeResponseSchema, {
    target: "draft-2020-12",
  }),
  PodcastsResponse: z.toJSONSchema(podcastsResponseSchema, {
    target: "draft-2020-12",
  }),
  ReaderPageResponse: z.toJSONSchema(readerPageResponseSchema, {
    target: "draft-2020-12",
  }),
  SavedViewsResponse: z.toJSONSchema(savedViewsResponseSchema, {
    target: "draft-2020-12",
  }),
}

function jsonResponse(schema: keyof typeof schemas) {
  return {
    content: {
      "application/json": {
        schema: { $ref: `#/components/schemas/${schema}` },
      },
    },
    description: "A private Arctic RSS API response.",
  }
}

const defaultErrors = {
  "401": jsonResponse("ApiV1Error"),
  "429": jsonResponse("ApiV1Error"),
  "500": jsonResponse("ApiV1Error"),
  "503": jsonResponse("ApiV1Error"),
}

export const mobileApiV1OpenApiDocument = {
  components: { schemas },
  info: {
    description:
      "Private first-party client API for Arctic RSS. It is not a public developer API and no webhook compatibility is promised.",
    title: "Arctic RSS first-party API",
    version: "v1",
  },
  openapi: "3.1.1",
  paths: {
    "/api/v1/articles/{articleId}": {
      get: {
        operationId: "getArticle",
        responses: { "200": jsonResponse("ArticleDetailResponse"), "404": jsonResponse("ApiV1Error"), ...defaultErrors },
        summary: "Get one authorized article with its sanitized body.",
      },
    },
    "/api/v1/briefings": {
      get: {
        operationId: "listBriefings",
        responses: { "200": jsonResponse("BriefingsResponse"), ...defaultErrors },
        summary: "List generated Smart Digest briefings.",
      },
    },
    "/api/v1/collections": {
      get: {
        operationId: "listCollections",
        responses: { "200": jsonResponse("CollectionsResponse"), ...defaultErrors },
        summary: "List the authenticated user's collections.",
      },
    },
    "/api/v1/feeds": {
      get: {
        operationId: "listFeeds",
        responses: { "200": jsonResponse("FeedsResponse"), ...defaultErrors },
        summary: "List subscribed feeds and navigation state.",
      },
    },
    "/api/v1/me": {
      get: {
        operationId: "getMe",
        responses: { "200": jsonResponse("MeResponse"), ...defaultErrors },
        summary: "Get the authenticated account's mobile-safe profile.",
      },
    },
    "/api/v1/podcast-episodes/{episodeId}": {
      get: {
        operationId: "getPodcastEpisode",
        responses: { "200": jsonResponse("PodcastEpisodeResponse"), "404": jsonResponse("ApiV1Error"), ...defaultErrors },
        summary: "Get one authorized podcast episode.",
      },
    },
    "/api/v1/podcasts": {
      get: {
        operationId: "listPodcasts",
        responses: { "200": jsonResponse("PodcastsResponse"), ...defaultErrors },
        summary: "List subscribed podcasts and recent episodes.",
      },
    },
    "/api/v1/reader": {
      get: {
        operationId: "listReaderArticles",
        responses: { "200": jsonResponse("ReaderPageResponse"), ...defaultErrors },
        summary: "List authorized reader article metadata without bodies.",
      },
    },
    "/api/v1/saved-views": {
      get: {
        operationId: "listSavedViews",
        responses: { "200": jsonResponse("SavedViewsResponse"), ...defaultErrors },
        summary: "List the authenticated user's saved search views.",
      },
    },
    "/api/v1/search": {
      get: {
        operationId: "searchArticles",
        responses: { "200": jsonResponse("ReaderPageResponse"), ...defaultErrors },
        summary: "Search authorized reader article metadata without bodies.",
      },
    },
  },
  security: [{ ArcticRssSession: [] }],
  servers: [{ url: "https://arcticrss.com" }],
}

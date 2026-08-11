import { z } from "zod"

import {
  deviceAuthorizationExchangeRequestSchema,
  meResponseSchema,
  mobileTokenResponseSchema,
} from "./account"
import { articleDetailResponseSchema, readerPageResponseSchema } from "./articles"
import { briefingDetailResponseSchema, briefingsResponseSchema } from "./briefings"
import { collectionsResponseSchema } from "./collections"
import { apiV1ErrorEnvelopeSchema } from "./errors"
import { feedsResponseSchema } from "./feeds"
import {
  articleStateMutationRequestSchema,
  articleStateMutationResponseSchema,
  collectionItemMutationResponseSchema,
  collectionItemRequestSchema,
  deviceSessionLogoutResponseSchema,
  podcastEpisodeStateMutationResponseSchema,
  podcastProgressMutationRequestSchema,
  podcastStateMutationRequestSchema,
} from "./mutations"
import {
  deviceInstallationRequestSchema,
  deviceInstallationResponseSchema,
  deviceInstallationUnregisterRequestSchema,
  notificationPreferenceUpdateRequestSchema,
  notificationPreferenceUpdateResponseSchema,
  notificationPreferencesResponseSchema,
} from "./notifications"
import { podcastEpisodeResponseSchema, podcastsResponseSchema } from "./podcasts"
import { savedViewsResponseSchema } from "./saved-views"
import { syncResponseSchema } from "./sync"

const schemas = {
  ApiV1Error: z.toJSONSchema(apiV1ErrorEnvelopeSchema, { target: "draft-2020-12" }),
  ArticleDetailResponse: z.toJSONSchema(articleDetailResponseSchema, {
    target: "draft-2020-12",
  }),
  ArticleStateMutationRequest: z.toJSONSchema(articleStateMutationRequestSchema, {
    target: "draft-2020-12",
  }),
  ArticleStateMutationResponse: z.toJSONSchema(articleStateMutationResponseSchema, {
    target: "draft-2020-12",
  }),
  BriefingsResponse: z.toJSONSchema(briefingsResponseSchema, {
    target: "draft-2020-12",
  }),
  BriefingDetailResponse: z.toJSONSchema(briefingDetailResponseSchema, {
    target: "draft-2020-12",
  }),
  CollectionsResponse: z.toJSONSchema(collectionsResponseSchema, {
    target: "draft-2020-12",
  }),
  CollectionItemMutationResponse: z.toJSONSchema(collectionItemMutationResponseSchema, {
    target: "draft-2020-12",
  }),
  CollectionItemRequest: z.toJSONSchema(collectionItemRequestSchema, {
    target: "draft-2020-12",
  }),
  DeviceInstallationRequest: z.toJSONSchema(deviceInstallationRequestSchema, {
    target: "draft-2020-12",
  }),
  DeviceInstallationResponse: z.toJSONSchema(deviceInstallationResponseSchema, {
    target: "draft-2020-12",
  }),
  DeviceInstallationUnregisterRequest: z.toJSONSchema(deviceInstallationUnregisterRequestSchema, {
    target: "draft-2020-12",
  }),
  DeviceSessionLogoutResponse: z.toJSONSchema(deviceSessionLogoutResponseSchema, {
    target: "draft-2020-12",
  }),
  DeviceAuthorizationExchangeRequest: z.toJSONSchema(deviceAuthorizationExchangeRequestSchema, {
    target: "draft-2020-12",
  }),
  FeedsResponse: z.toJSONSchema(feedsResponseSchema, { target: "draft-2020-12" }),
  MeResponse: z.toJSONSchema(meResponseSchema, { target: "draft-2020-12" }),
  MobileTokenResponse: z.toJSONSchema(mobileTokenResponseSchema, {
    target: "draft-2020-12",
  }),
  NotificationPreferenceUpdateRequest: z.toJSONSchema(notificationPreferenceUpdateRequestSchema, {
    target: "draft-2020-12",
  }),
  NotificationPreferenceUpdateResponse: z.toJSONSchema(notificationPreferenceUpdateResponseSchema, {
    target: "draft-2020-12",
  }),
  NotificationPreferencesResponse: z.toJSONSchema(notificationPreferencesResponseSchema, {
    target: "draft-2020-12",
  }),
  PodcastEpisodeStateMutationResponse: z.toJSONSchema(podcastEpisodeStateMutationResponseSchema, {
    target: "draft-2020-12",
  }),
  PodcastProgressMutationRequest: z.toJSONSchema(podcastProgressMutationRequestSchema, {
    target: "draft-2020-12",
  }),
  PodcastStateMutationRequest: z.toJSONSchema(podcastStateMutationRequestSchema, {
    target: "draft-2020-12",
  }),
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
  SyncResponse: z.toJSONSchema(syncResponseSchema, { target: "draft-2020-12" }),
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

function jsonRequest(schema: keyof typeof schemas) {
  return {
    content: {
      "application/json": {
        schema: { $ref: `#/components/schemas/${schema}` },
      },
    },
    required: true,
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
    "/api/v1/articles/{articleId}/state": {
      patch: {
        operationId: "updateArticleState",
        requestBody: jsonRequest("ArticleStateMutationRequest"),
        responses: {
          "200": jsonResponse("ArticleStateMutationResponse"),
          "400": jsonResponse("ApiV1Error"),
          "409": jsonResponse("ApiV1Error"),
          ...defaultErrors,
        },
        summary: "Idempotently update read, star, or archive state for one article.",
      },
    },
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
    "/api/v1/briefings/{briefingId}": {
      get: {
        operationId: "getBriefing",
        responses: { "200": jsonResponse("BriefingDetailResponse"), "404": jsonResponse("ApiV1Error"), ...defaultErrors },
        summary: "Get one authorized Smart Digest briefing with its bounded item details.",
      },
    },
    "/api/v1/collections": {
      get: {
        operationId: "listCollections",
        responses: { "200": jsonResponse("CollectionsResponse"), ...defaultErrors },
        summary: "List the authenticated user's collections.",
      },
    },
    "/api/v1/collections/{collectionId}/items": {
      post: {
        operationId: "addCollectionItem",
        requestBody: jsonRequest("CollectionItemRequest"),
        responses: {
          "200": jsonResponse("CollectionItemMutationResponse"),
          "400": jsonResponse("ApiV1Error"),
          "404": jsonResponse("ApiV1Error"),
          "409": jsonResponse("ApiV1Error"),
          ...defaultErrors,
        },
        summary: "Idempotently save an authorized article to an existing collection.",
      },
    },
    "/api/v1/collections/{collectionId}/items/{articleId}": {
      delete: {
        operationId: "removeCollectionItem",
        responses: {
          "200": jsonResponse("CollectionItemMutationResponse"),
          "400": jsonResponse("ApiV1Error"),
          "404": jsonResponse("ApiV1Error"),
          "409": jsonResponse("ApiV1Error"),
          ...defaultErrors,
        },
        summary: "Idempotently remove an article from an existing collection.",
      },
    },
    "/api/v1/device-authorizations/exchange": {
      post: {
        operationId: "exchangeDeviceAuthorizationCode",
        requestBody: jsonRequest("DeviceAuthorizationExchangeRequest"),
        responses: {
          "200": jsonResponse("MobileTokenResponse"),
          "400": jsonResponse("ApiV1Error"),
          "409": jsonResponse("ApiV1Error"),
          ...defaultErrors,
        },
        summary: "Exchange a browser-issued PKCE authorization code for rotating device tokens.",
      },
    },
    "/api/v1/device-sessions/refresh": {
      post: {
        operationId: "refreshDeviceSession",
        responses: {
          "200": jsonResponse("MobileTokenResponse"),
          "400": jsonResponse("ApiV1Error"),
          ...defaultErrors,
        },
        summary: "Rotate a first-party device refresh token.",
      },
    },
    "/api/v1/device-sessions/current/logout": {
      post: {
        operationId: "logoutCurrentDeviceSession",
        responses: { "200": jsonResponse("DeviceSessionLogoutResponse"), ...defaultErrors },
        summary: "Revoke the current bearer device session and its push installation references.",
      },
    },
    "/api/v1/device-installations/current": {
      delete: {
        operationId: "unregisterCurrentDeviceInstallation",
        requestBody: jsonRequest("DeviceInstallationUnregisterRequest"),
        responses: {
          "200": jsonResponse("DeviceInstallationResponse"),
          "400": jsonResponse("ApiV1Error"),
          "404": jsonResponse("ApiV1Error"),
          "409": jsonResponse("ApiV1Error"),
          ...defaultErrors,
        },
        summary: "Disable an unregistered push installation for the current device session.",
      },
      put: {
        operationId: "registerCurrentDeviceInstallation",
        requestBody: jsonRequest("DeviceInstallationRequest"),
        responses: {
          "200": jsonResponse("DeviceInstallationResponse"),
          "400": jsonResponse("ApiV1Error"),
          "409": jsonResponse("ApiV1Error"),
          ...defaultErrors,
        },
        summary: "Register a protected push installation reference for the current device session.",
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
    "/api/v1/podcast-episodes/{episodeId}/progress": {
      patch: {
        operationId: "updatePodcastEpisodeProgress",
        requestBody: jsonRequest("PodcastProgressMutationRequest"),
        responses: {
          "200": jsonResponse("PodcastEpisodeStateMutationResponse"),
          "400": jsonResponse("ApiV1Error"),
          "404": jsonResponse("ApiV1Error"),
          "409": jsonResponse("ApiV1Error"),
          ...defaultErrors,
        },
        summary: "Idempotently update playback progress for one authorized episode.",
      },
    },
    "/api/v1/podcast-episodes/{episodeId}/state": {
      patch: {
        operationId: "updatePodcastEpisodeState",
        requestBody: jsonRequest("PodcastStateMutationRequest"),
        responses: {
          "200": jsonResponse("PodcastEpisodeStateMutationResponse"),
          "400": jsonResponse("ApiV1Error"),
          "404": jsonResponse("ApiV1Error"),
          "409": jsonResponse("ApiV1Error"),
          ...defaultErrors,
        },
        summary: "Idempotently update played or starred state for one authorized episode.",
      },
    },
    "/api/v1/podcasts": {
      get: {
        operationId: "listPodcasts",
        responses: { "200": jsonResponse("PodcastsResponse"), ...defaultErrors },
        summary: "List subscribed podcasts and recent episodes.",
      },
    },
    "/api/v1/notification-preferences": {
      get: {
        operationId: "listNotificationPreferences",
        responses: { "200": jsonResponse("NotificationPreferencesResponse"), ...defaultErrors },
        summary: "List centralized mobile-safe notification delivery preferences.",
      },
    },
    "/api/v1/notification-preferences/{topic}": {
      put: {
        operationId: "updateNotificationPreference",
        requestBody: jsonRequest("NotificationPreferenceUpdateRequest"),
        responses: {
          "200": jsonResponse("NotificationPreferenceUpdateResponse"),
          "400": jsonResponse("ApiV1Error"),
          "409": jsonResponse("ApiV1Error"),
          ...defaultErrors,
        },
        summary: "Idempotently update one centralized notification delivery preference.",
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
    "/api/v1/sync": {
      get: {
        operationId: "syncUserChanges",
        responses: {
          "200": jsonResponse("SyncResponse"),
          "400": jsonResponse("ApiV1Error"),
          "409": jsonResponse("ApiV1Error"),
          ...defaultErrors,
        },
        summary: "Read the current device session's incremental user sync events and tombstones.",
      },
    },
  },
  security: [{ ArcticRssSession: [] }],
  servers: [{ url: "https://arcticrss.com" }],
}

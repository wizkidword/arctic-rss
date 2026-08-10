import { describe, expect, it } from "vitest"

import {
  apiV1FixtureArticleListItem,
  apiV1FixtureMe,
  apiV1FixtureRequestId,
  articleDetailResponseSchema,
  mobileApiV1OpenApiDocument,
  readerPageResponseSchema,
} from "./index"

describe("first-party API v1 contract", () => {
  it("keeps list responses metadata-only while allowing a bounded detail body", () => {
    const list = readerPageResponseSchema.parse({
      data: { articles: [apiV1FixtureArticleListItem] },
      meta: { nextCursor: null, requestId: apiV1FixtureRequestId },
    })

    expect(list.data.articles[0]).not.toHaveProperty("contentHtml")
    expect(list.data.articles[0]).not.toHaveProperty("contentText")

    expect(
      articleDetailResponseSchema.parse({
        data: {
          ...apiV1FixtureArticleListItem,
          author: null,
          contentHtml: "<p>Sanitized body</p>",
          contentText: "Sanitized body",
          readAt: null,
          starredAt: null,
        },
        meta: { requestId: apiV1FixtureRequestId },
      }).data
    ).toMatchObject({ contentText: "Sanitized body" })
  })

  it("publishes the complete private v1 surface as a serializable OpenAPI document", () => {
    expect(apiV1FixtureMe.email).toBe("reader@example.test")
    expect(Object.keys(mobileApiV1OpenApiDocument.paths)).toEqual([
      "/api/v1/articles/{articleId}",
      "/api/v1/briefings",
      "/api/v1/collections",
      "/api/v1/device-authorizations/exchange",
      "/api/v1/device-sessions/refresh",
      "/api/v1/feeds",
      "/api/v1/me",
      "/api/v1/podcast-episodes/{episodeId}",
      "/api/v1/podcasts",
      "/api/v1/reader",
      "/api/v1/saved-views",
      "/api/v1/search",
    ])
    expect(JSON.parse(JSON.stringify(mobileApiV1OpenApiDocument)).openapi).toBe("3.1.1")
  })
})

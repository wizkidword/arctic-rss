export type ApiV1Endpoint =
  | "articles"
  | "article-state"
  | "briefings"
  | "collections"
  | "collection-items"
  | "device-installations"
  | "device-sessions"
  | "feeds"
  | "me"
  | "notification-preferences"
  | "podcast-episodes"
  | "podcasts"
  | "reader"
  | "saved-views"
  | "search"
  | "sync"

export type ApiV1AuthMode = "device-session" | "web-session"

export type ApiV1RateLimitResult =
  | "allowed"
  | "not_checked"
  | "rate_limited"
  | "unavailable"

export function recordApiV1Request({
  authMode,
  durationMs,
  endpoint,
  pageSize,
  rateLimitResult,
  requestId,
  statusCode,
}: {
  authMode: ApiV1AuthMode
  durationMs: number
  endpoint: ApiV1Endpoint
  pageSize: number | null
  rateLimitResult: ApiV1RateLimitResult
  requestId: string
  statusCode: number
}) {
  // This intentionally carries only low-cardinality operational dimensions.
  // Do not add account identifiers, search terms, article data, tokens, or
  // application headers here.
  console.info(
    JSON.stringify({
      authMode,
      durationMs,
      endpoint,
      event: "mobile_api_v1_request",
      pageSize,
      rateLimitResult,
      requestId,
      statusCode,
    })
  )
}

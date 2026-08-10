export type ApiV1Endpoint =
  | "articles"
  | "briefings"
  | "collections"
  | "feeds"
  | "me"
  | "podcast-episodes"
  | "podcasts"
  | "reader"
  | "saved-views"
  | "search"

export type ApiV1RateLimitResult =
  | "allowed"
  | "not_checked"
  | "rate_limited"
  | "unavailable"

export function recordApiV1Request({
  durationMs,
  endpoint,
  pageSize,
  rateLimitResult,
  requestId,
  statusCode,
}: {
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
      authMode: "web-session",
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

# First-party API v1

`/api/v1` is Arctic RSS's private, versioned API for its own web and future
native clients. It is not a public developer API and does not provide API keys,
webhooks, or third-party compatibility guarantees.

## Contract sources

- Zod schemas and inferred TypeScript types: `packages/api-contract/src/`
- Stable fixtures and contract tests: `packages/api-contract/src/fixtures.ts`
  and `packages/api-contract/src/contract.test.ts`
- Generated OpenAPI 3.1 document: `docs/mobile/openapi-v1.json`
- Regenerate after a contract change: `npm run api:openapi:write`
- Verify the committed document: `npm run api:openapi:check`

## Authentication and transport

All endpoints require an authenticated, fresh Arctic RSS account. Phase 10
uses the existing web-session authorization boundary so disabled accounts and
`authVersion` changes are enforced immediately. Device authorization, PKCE,
rotating refresh tokens, reuse detection, and device revocation are Phase 11
work; a native client must not treat a server cookie as a permanent credential.

User data responses set `Cache-Control: private, no-store, max-age=0`, include
an `X-Request-Id` header, and carry the same ID in their JSON envelope. Private
API reads fail closed if rate limiting is unavailable.

## Envelope

Successful responses use:

```json
{
  "data": {},
  "meta": {
    "nextCursor": "opaque cursor or null when paged",
    "requestId": "uuid"
  }
}
```

Errors use:

```json
{
  "error": {
    "code": "ARTICLE_NOT_FOUND",
    "message": "That article is unavailable.",
    "requestId": "uuid",
    "retryable": false
  }
}
```

`REQUEST_VALIDATION_FAILED` can include at most five field/message pairs.
Responses never include stack traces or cross-account resource IDs.

## Read-only endpoints

| Endpoint | Purpose | Pagination |
| --- | --- | --- |
| `GET /api/v1/me` | Current mobile-safe profile | none |
| `GET /api/v1/reader` | Authorized article card metadata | `cursor`, `limit` (max 50) |
| `GET /api/v1/articles/:id` | One authorized article with sanitized body | none |
| `GET /api/v1/search` | Authorized article card metadata for a bounded query | `cursor`, `limit` (max 50) |
| `GET /api/v1/saved-views` | Saved search views | `cursor`, `limit` (max 50) |
| `GET /api/v1/collections` | Collection picker data | product-bounded |
| `GET /api/v1/feeds` | Feed navigation data | source-limit bounded |
| `GET /api/v1/podcasts` | Subscribed podcasts and recent episodes | `cursor`, `limit` (max 50) |
| `GET /api/v1/podcast-episodes/:id` | One authorized podcast episode | none |
| `GET /api/v1/briefings` | Smart Digest briefing summaries | `cursor`, `limit` (max 50) |

`/reader` accepts optional `feedId`, `folderId`, `collectionId`, and
`state=all|unread|starred`. `/search` accepts `q` (maximum 200 characters),
the corresponding source/folder/collection filters, `state`, and optional
calendar-date bounds. Unknown or duplicate query parameters are rejected.

List DTOs never contain `contentHtml` or `contentText`. Client applications
must request a selected item through its detail endpoint before rendering a
full body.

## Deferred writes

API v1 is read-only in Phase 10. Phase 12 will add state, collection, podcast
progress, session logout, and sync writes only with device-session
authentication and idempotency receipts. Advanced source management remains
web-only for mobile v1.

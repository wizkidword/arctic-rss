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

All endpoints require an authenticated, fresh Arctic RSS account. Browser
sessions remain valid only for browser-mediated authorization. Native clients
must start at `GET /api/mobile/authorize` with the fixed first-party redirect
URI, `state`, nonce, and a PKCE S256 challenge, then exchange the returned
single-use code at `POST /api/v1/device-authorizations/exchange`. The exchange
and `POST /api/v1/device-sessions/refresh` return a 15-minute bearer access
token and a rotating refresh token. Native clients send access tokens as
`Authorization: Bearer <token>`; they never use a permanent server cookie.

Authorization codes and refresh tokens are stored only as hashes. The server
checks `disabledAt` and `authVersion` at code issue, exchange, access use, and
refresh. Refresh-token reuse revokes the whole device token family. Users can
revoke a device or every mobile device from `/app/settings/devices`.

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

## Device authorization endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /api/mobile/authorize` | System-browser authorization endpoint; redirects to the registered mobile URI with `code` and the supplied `state` after fresh web login |
| `POST /api/v1/device-authorizations/exchange` | Exchanges `code`, `codeVerifier`, nonce, and the exact `redirectUri` for an access token and rotating refresh token |
| `POST /api/v1/device-sessions/refresh` | Replaces a refresh token with a new access/refresh-token pair; a previous-token reuse invalidates its family |

The registered redirect URI is currently `arcticrss://auth/callback`; requests
must use PKCE `S256`. Access and refresh token strings are response secrets:
clients must use platform secure storage and must never put them in telemetry,
URLs, screenshots, or diagnostics.

`/reader` accepts optional `feedId`, `folderId`, `collectionId`, and
`state=all|unread|starred`. `/search` accepts `q` (maximum 200 characters),
the corresponding source/folder/collection filters, `state`, and optional
calendar-date bounds. Unknown or duplicate query parameters are rejected.

List DTOs never contain `contentHtml` or `contentText`. Client applications
must request a selected item through its detail endpoint before rendering a
full body.

## Device-session sync and writes

Phase 12 adds device-session-only operations. Each content mutation requires a
bearer device session plus an `Idempotency-Key`; browser cookies cannot make
mobile writes or read `/api/v1/sync`.

| Endpoint | Purpose |
| --- | --- |
| `PATCH /api/v1/articles/:id/state` | Set read, starred, or archived state |
| `POST /api/v1/collections/:id/items` | Save an authorized article to an existing collection |
| `DELETE /api/v1/collections/:id/items/:articleId` | Remove an article from a collection |
| `PATCH /api/v1/podcast-episodes/:id/progress` | Set playback position |
| `PATCH /api/v1/podcast-episodes/:id/state` | Set played or starred state |
| `POST /api/v1/device-sessions/current/logout` | Revoke the current device session |
| `GET /api/v1/sync` | Read compact user changes and tombstones |
| `GET/PUT /api/v1/notification-preferences` | Read/update central delivery preferences |
| `PUT/DELETE /api/v1/device-installations/current` | Register or disable a protected push-installation reference |

Mutation receipts are session-bound and retain only a small response DTO. A
same-key retry returns `replayed: true`; a same key with a different payload
returns `409 IDEMPOTENCY_KEY_REUSED`. A cursor older than the retained event
window returns `409 FULL_RESYNC_REQUIRED`. See
[`mobile-sync-contract.md`](mobile-sync-contract.md) for the full cursor,
tombstone, retention, and push-data rules.

Advanced source replacement, bulk source actions, OPML, administration, and
full-library offline sync remain web-only or deferred.

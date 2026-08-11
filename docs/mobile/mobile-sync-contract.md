# Mobile sync contract

## Scope

Phase 12 adds one bounded, user-scoped change stream for the first-party
mobile client. It is deliberately not a full-library offline protocol. The
client may retain recent articles, starred items, selected collections, recent
podcast metadata/positions, queued mutations, and one cursor.

`GET /api/v1/sync` requires a current bearer device session. It never accepts a
browser cookie as a native synchronization credential.

## Cursors and retention

Events have a PostgreSQL-assigned, monotonically increasing `sequence`. A
cursor is the decimal-string form of the last applied sequence. Queries remain
user-scoped even though the sequence is global.

The database retains each user's events for 180 days. Trigger-driven pruning
also advances a per-user cursor floor. If a supplied cursor is older than that
floor, the API returns `409 FULL_RESYNC_REQUIRED`. Clients must not silently
apply a partial delta. Until a truthful bootstrap endpoint is available, the
Android client preserves its current cursor and bounded cache instead of
pretending the first incremental page is a full resync.

Responses contain compact schema-versioned `UPSERT` and `TOMBSTONE` events
only. Version 1 is a strict typed union for article state, collection,
collection item, podcast episode state, saved view, feed subscription, podcast
subscription, briefing, and notification preference changes. Their payloads
carry identifiers and state flags/timestamps, never article bodies, search
queries, refresh tokens, push tokens, or account email addresses.

`hasMore` is true when the response page is full and a later event exists.
`nextCursor` is the last sequence returned in the page, or the supplied cursor
when no events were returned. A client sends that cursor only after it has
validated and applied every event in the page. Unknown event shapes or schema
versions are rejected and must leave the cursor unchanged.

The Android client currently validates each page, clears only its bounded
derived cache when a page contains events, and writes the next cursor plus any
local product milestone in the same SQLite transaction. Pending mutations are
not part of event invalidation. Product milestones are local-only until a
truthful post-commit telemetry signal exists; the sync request does not accept
or emit an unverified milestone header.

The first event sources are article state, collection membership, podcast
episode state, saved views, feed and podcast subscriptions, Smart Digest
availability, and notification preferences. PostgreSQL triggers append the
event in the same transaction as each source-table mutation, so web and native
changes share the stream.

## Offline writes and receipts

The following device-session-only operations require an `Idempotency-Key`
header containing 16–128 safe characters:

- `PATCH /api/v1/articles/:id/state`
- `POST /api/v1/collections/:id/items`
- `DELETE /api/v1/collections/:id/items/:articleId`
- `PATCH /api/v1/podcast-episodes/:id/progress`
- `PATCH /api/v1/podcast-episodes/:id/state`
- Notification preference and protected device-installation updates.

Receipts are unique by device session and a SHA-256 digest of the idempotency
key. The request is separately canonicalized and hashed. A retry with the
same key and request returns the original small result with `replayed: true`;
using the key for another operation or payload returns
`409 IDEMPOTENCY_KEY_REUSED`. The receipt, underlying write, and emitted sync
event share one database transaction. Receipts retain only bounded mobile DTOs
for 30 days and do not store article bodies, tokens, or raw push values.

Current-device logout intentionally revokes the bearer session, so an already
revoked token cannot replay a logout request. It also disables the session's
push-installation references.

## Push and notification foundations

The preference center has four topics: security alerts, saved-monitor matches,
Smart Digest completion, and future chat mentions. Each chooses one explicit
channel: in-app, email, mobile push, or disabled. This phase records central
preferences and protected Android installation hashes only; it does not enable
a push provider or chat push delivery.

An unregistered client calls the current-installation delete endpoint with its
push token. The raw value is used only to derive a hash and is never stored or
returned.

## Deep links

Stable HTTPS fallback paths are:

- `/articles/:id`
- `/podcast-episodes/:id`
- `/collections/:id`
- `/saved-views/:id`
- `/briefings/:id`

Unauthenticated browser visits go through the existing same-origin login
callback path. After authentication, the destination's normal ownership check
decides access; deleted or unauthorized podcast episodes and saved views return
a safe not-found response. The Phase 13 Expo workspace declares the matching
Android App Link filters, but no Android signing identity or
`assetlinks.json` statement exists yet. App Link verification remains pending
until the signed-build handoff is completed.

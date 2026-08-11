# Mobile offline mutation and conflict behavior

## Scope

The Android alpha queues only small, idempotent v1 writes: article state,
collection membership, podcast progress/state, and notification preferences.
It never queues article bodies, raw push tokens, credentials, browser cookies,
or arbitrary request paths.

Each entry is scoped to the current stable mobile device and account, and
records a local ID, idempotency key, operation/resource metadata, bounded
payload, creation/update times, attempt count, last attempt/error code, an
optional expected version, next-retry time, and one explicit state:

- `PENDING`
- `SENDING`
- `RETRYABLE_FAILURE`
- `CONFLICT`
- `PERMANENT_FAILURE`
- `COMPLETED`

SQLite schema version 2 upgrades a version-1 entry only when the existing
local owner record is present and the stored request can be validated. Rows
that cannot be safely tied to that owner are removed, as are malformed rows.
This alpha migration preserves valid owned entries; it never relabels an
unknown entry as belonging to a newly signed-in account.

## Replay rules

- A received response marks the entry `COMPLETED`; completed entries are
  reclaimed only during a later enqueue.
- Network and retryable service failures become `RETRYABLE_FAILURE`, retain
  their original idempotency key, and stop the current pass. Retry delay starts
  at five seconds and backs off to one hour.
- A stale sending claim is recovered after one minute as a retryable
  interruption. The next pass retains the same key, so a lost response after a
  token refresh remains safe to replay exactly once at the server.
- `401` marks bounded local evidence before the existing session-owner flow
  clears the device; it is never replayed under another account.
- Missing resources and idempotency-key reuse become `CONFLICT`. Other
  nonretryable responses become `PERMANENT_FAILURE`.
- Unknown failures are retained as retryable evidence rather than silently
  deleted.

The Offline changes need attention screen shows safe operation labels and
mapped reasons only. It lets the owner retry (returning a terminal entry to
`PENDING`), discard it explicitly, or open the current in-app resource when
one has a safe route. It does not render raw server errors, IDs, credentials,
or request payloads.

## Current operation semantics

- Article state writes are explicit set operations; archive retains the server
  rule that it also marks the article read.
- Collection add/remove is set membership. A missing collection or article is
  preserved as a conflict rather than discarded.
- Podcast position/state uses the server's duration and state validation.
  The mobile queue stores an optional expected version for a later server-side
  stale-progress rule; this alpha does not yet send one.
- Notification preference changes are explicit per topic. Channels outside
  the API contract are rejected before queueing.

This is source behavior only. Native SQLite upgrade/failure injection and
disposable end-to-end replay evidence remain open; no production data,
deployment, or mobile release action is represented by this document.

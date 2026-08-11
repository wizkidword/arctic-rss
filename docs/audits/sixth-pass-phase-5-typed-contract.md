# Sixth-pass Phase 5 typed sync contract

**Status:** source-verified; local transactional application remains open.

`GET /api/v1/sync` now exposes a strict schema-version-1 union for all nine
required resource families: article state, collection, collection item,
podcast episode state, saved view, feed subscription, podcast subscription,
briefing, and notification preference. Every variant supplies the required
action, resource type/ID/version, occurrence time, sequence, schema version,
and a bounded typed payload. The OpenAPI document is regenerated from that
contract.

The server validates every journal row as it becomes a public mobile event.
An unknown resource, version, or payload shape therefore fails the request
instead of being presented as arbitrary JSON. The Phase 5 cursor guard leaves
such a response unacknowledged on the client. `hasMore` and `nextCursor` now
have explicit page semantics.

This slice does not yet add the collection trigger, local event invalidation,
bootstrap/full resync, native SQLite failure injection, or disposable-PostgreSQL
convergence proof. No database migration has been applied and no deployment
occurred.

# Sixth-pass Phase 5 collection lifecycle events

**Status:** source-verified migration and contract; not applied.

`20260811130000_add_mobile_collection_sync_events` adds a trigger that emits
compact typed collection upsert and tombstone events for future collection
changes. On collection deletion, the collection tombstone is the coarse
invalidation signal; cascaded collection-item rows remain suppressed rather
than producing an incomplete or misleading child-event sequence.

The existing transaction-local user-deletion marker suppresses all collection
events during account deletion. No collection is backfilled, no existing row
is rewritten, and no production or disposable PostgreSQL migration has run in
this slice. The hash-bound risk record requires that rehearsal before release.

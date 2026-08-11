# Sixth-pass Phase 5 cursor safety

**Status:** source-verified fail-closed guard; typed sync remains in progress.

The existing mobile client had no event-application path, yet it committed the
server-provided cursor and first-sync milestone after every response. A
non-empty event page could therefore be acknowledged and never processed.

Until the typed event contract and transactional invalidation logic exist, the
client leaves both cursor and milestone unchanged whenever a sync response
contains events. Empty pages can commit because there are no events to apply.
The same guard applies after a retention-floor response. This intentionally
trades incremental-sync progress for replay safety; it is not a full-resync
implementation and does not make any runtime or deployment claim.

# Sixth-pass Phase 4 local owner boundary

**Status:** source-verified; no Android artifact or production action.

SQLite now has a single `mobile_store_metadata` owner row containing only the
authenticated user ID and stable mobile-device ID. Cache, sync cursor,
milestone, and pending-mutation operations require that exact in-memory and
stored owner match. A startup with no valid token bundle, a corrupted bundle,
or an account/device switch purges local cache, queue, cursor, milestones, and
owner metadata before application sync can run.

The signed-in provider claims ownership after session hydration and before any
flush or synchronization. The v1 alpha token keys lack these identifiers and
are cleared rather than used to hydrate local account data.

Authenticated Expo route grouping, Android backup exclusion verification, and
the broader offline/account-switch test matrix remain open.

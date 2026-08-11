# Sixth-pass Phase 3 token-persistence slice

**Status:** source-verified; no production or signing action.

This slice makes the Android client’s token boundary concurrency-safe before
the separate additive stable-device migration:

- `MobileSessionManager` exposes one shared refresh promise for all concurrent
  callers, including a forced refresh after a single API `401` replay.
- A replacement token bundle is persisted before it is placed in memory.
  Retryable transport or storage failures retain the prior complete bundle;
  terminal refresh failures clear it once.
- A local sign-out cannot be overwritten by a late refresh result.
- SecureStore now uses one validated v2 JSON bundle. The three alpha v1 keys
  are migrated only after the v2 write succeeds, then removed. Unknown or
  malformed bundle versions are not returned to the app.

This does not yet contain `userId` or `mobileDeviceId`: those fields depend on
the pending stable `MobileDevice` model and token contract. Device identity,
family-aware cleanup, and the disposable PostgreSQL migration rehearsal remain
separate Phase 3 work.

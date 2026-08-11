# Sixth-pass Phase 7: mobile request boundary and foreground coordination

**Status:** source-verified locally; device and production evidence remain
open.

## Implemented source slice

`MobileApiClient` now applies bounded defaults to every read and write, merges
the caller's cancellation signal with its deadline, bounds JSON response
bytes, and keeps malformed or oversized responses generic. The same boundary
also covers access-token acquisition and the one coordinated refresh attempt.
`429` and `503` responses expose `Retry-After` as milliseconds. A normal
mutation is never automatically replayed after `401`; the one replay path is
limited to reads or calls carrying an idempotency key.

The app has one foreground coordinator. It claims the confirmed local owner,
flushes queued mutations, performs bootstrap or incremental sync, then bumps a
query revision so visible screens reload. Overlapping triggers request a
follow-up pass rather than opening a second queue or cursor transaction.
Hydration, browser sign-in, app activation, and the conflict-inbox retry all
use that path. The current app has no network-status subscription; app
activation is the available connectivity-recovery trigger.

Queries pass cancellation through to the API, abort on replacement or
unmount, retain a cache value only for the active owner and key, and do not
turn a generic `401` into immediate local logout. The provider clears the
session only after the coordinated request path has exhausted its refresh
policy. The conflict inbox exposes the current sync state, and Settings shows
the last successful sync time.

## Verification boundary

- Focused tests cover deadlines, caller cancellation, stalled token reads,
  bounded responses, `Retry-After`, non-idempotent `401`, coordinator
  serialization, manual follow-up, offline, and auth-required states.
- Queue tests confirm a deadline remains replayable only for the original
  idempotent mutation; caller cancellation is not saved or converted into a
  terminal queue failure.
- Root and mobile typecheck plus mobile lint pass before the final full-suite
  gate. The final export/native-config/full-suite results are recorded with the
  Phase 7 commit.

No service request was sent, no device was used, and no production, deployment,
Play, signing, migration, or remote-repository action occurred.

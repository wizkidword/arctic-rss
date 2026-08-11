# Sixth-pass Phase 5: bounded sync-retention maintenance

## Source change

Migration `20260811140000_move_mobile_sync_retention_to_maintenance` replaces
`append_user_sync_event` so source-table triggers append a compact event only.
It removes the per-user 180-day delete from ordinary application mutations.

`src/lib/mobile-sync-retention.ts` performs one lease-scheduled batch: it
selects a bounded oldest-first page, deletes only that expired page, advances
the maximum affected cursor floor with a monotonic SQL upsert in the same
transaction, and then reports only aggregate values. The transaction has a
five-second database statement timeout and a seven-second client transaction
budget. Its output includes oldest retained age and timestamp but no user,
device, token, email, or payload values.

The existing maintenance worker uses its durable Redis lease and normal
failure backoff. `MOBILE_SYNC_RETENTION_BATCH_SIZE` is clamped to 1–1,000
(default 250), and `MOBILE_SYNC_RETENTION_INTERVAL_MS` is clamped to one to
24 hours (default six hours). A pass is resumable: `moreEligible` remains true
when expired events still exist after the selected page.

## Verification boundary

- Unit tests cover bounded selection, no-op behavior, floor-upsert execution,
  aggregate result shape, and environment clamping.
- The new PostgreSQL integration test is CI-only. It inserts expired events,
  runs one bounded pass, checks the cursor floor, and verifies that the
  earlier cursor returns `FULL_RESYNC_REQUIRED`.
- The migration-risk record is hash-bound and contains no production approval.

This worktree did not apply the migration, run a disposable PostgreSQL
rehearsal, start the worker, change OVH, or perform a deployment. Retention
metrics are source logs; no production metric observation is claimed.

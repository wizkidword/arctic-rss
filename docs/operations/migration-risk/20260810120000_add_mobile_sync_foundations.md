# Migration risk record: mobile sync foundations

Migration name: `20260810120000_add_mobile_sync_foundations`
Migration SQL SHA-256: `d4610baba0b678aff9faa89a8d31a2537e72c9def668c291249ab3873a3d5cbc`
Author/date: Fifth-pass Phase 12 implementation; 2026-08-10
Affected tables: New `DeviceMutationReceipt`, `DeviceInstallation`, `UserNotificationPreference`, `UserSyncEvent`, and `UserSyncCursorFloor` tables; triggers on `ArticleState`, `ArticleCollectionItem`, `PodcastEpisodeState`, `SavedSearch`, `FeedSubscription`, `PodcastSubscription`, `SmartDigest`, `UserNotificationPreference`, and `User`; foreign keys reference `User`, `DeviceSession`, `ArticleCollection`, and `PodcastEpisode`.
Measured row counts: Not measured in this worktree. New tables are empty before release; obtain current production counts for the trigger source tables during an approved release review.
Measured table and index sizes: Not measured in this worktree. New tables and their indexes begin empty; obtain current catalog and storage evidence for existing trigger source tables during an approved release review.
Expected lock type: `CREATE TABLE`, supporting indexes, functions, and triggers take short catalog locks. New child-table foreign keys reference existing parent tables and require a bounded lock-wait review on `User`, `DeviceSession`, `ArticleCollection`, and `PodcastEpisode`.
Rewrite or scan risk: No existing rows are rewritten, deleted, or backfilled. The advisory classifier reports ten non-concurrent indexes and five foreign keys without `NOT VALID`; each index is on a new empty table and each foreign key is on a new empty child table. Creating triggers changes future writes only and does not scan or backfill their existing source tables.
Expected duration: Fast in a disposable PostgreSQL rehearsal. Production duration is not estimated from this worktree and depends on catalog activity and lock availability.
Online-safe strategy: Additive schema only. Use the approved release procedure with a fresh lock timeout and active-transaction review; stop rather than queue behind a blocking transaction. Do not assume a healthy application container proves a safe migration window.
Backfill plan: None. Synchronization events begin with post-release writes. Existing device and web sessions, article state, collection membership, podcast state, saved views, subscriptions, and briefings are not backfilled; clients with an earlier cursor receive the explicit full-resync-required response.
Validation plan: Passed the hash-bound migration-risk checker, Prisma validation/client generation, API OpenAPI drift check, TypeScript validation, and a disposable PostgreSQL 17.10 rehearsal that applied all 53 migrations. The real-database Phase 12 suite passed idempotent article-state replay and conflicting replay rejection, collection add/remove tombstones across device sessions, podcast state/progress sync, notification preference and token-hash lifecycle, and old-cursor full-resync enforcement. Before an approved production release, capture fresh lock, active-transaction, catalog, and backup evidence.
Maintenance mode required: No, provided the migration obtains its short catalog locks inside the approved lock timeout.
Rollback feasibility: High before mobile sync records are created because the changes are additive. After records exist, do not drop receipts, sync evidence, notification preferences, or token hashes during an incident; disable the feature and use a separately reviewed forward repair and retention decision.
Forward-recovery plan: If migration application fails, inspect the migration state and the named table, index, function, trigger, and constraint artifacts before retrying. Do not blindly rerun a partial migration. Preserve created sync and receipt evidence and use a reviewed forward repair.
Backup evidence ID requirement: The approved release must capture the exact fresh structured backup evidence ID before any migration execution.
Approver: Not granted for production execution. A later release requires the exact `DEPLOY <short-sha>` approval after all normal gates.
Approval timestamp: Not recorded because production ready is false.
Production ready: false
Production result: Not executed. This record covers checked-in migration SQL and local verification only.

## Retention and privacy boundary

- `DeviceMutationReceipt` stores only SHA-256 idempotency/request digests plus a
  bounded response DTO; it does not store the raw idempotency key or request
  body.
- `DeviceInstallation.tokenHash` stores a SHA-256 digest only; raw push tokens
  are not retained in the database.
- The database function prunes per-user sync events after 180 days and records
  the minimum retained sequence, so stale clients must perform an explicit full
  resync rather than silently receiving incomplete history.

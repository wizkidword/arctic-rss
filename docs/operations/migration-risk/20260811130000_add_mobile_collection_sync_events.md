# Migration risk record: mobile collection sync events

Migration name: `20260811130000_add_mobile_collection_sync_events`
Migration SQL SHA-256: `6ad343eb52cef0ff7097e01c4d03ebf4d8d4c359d6443537f34fdf61b3fc896e`
Author/date: Sixth-pass Phase 5 implementation; 2026-08-11
Affected tables: Existing `ArticleCollection` becomes a trigger source; existing `UserSyncEvent` receives compact future collection upsert/tombstone rows. The function reads `User` only when handling a deletion.
Measured row counts: Not measured in this source-only worktree. Capture current `ArticleCollection`, `User`, and `UserSyncEvent` counts during an approved release review.
Measured table and index sizes: Not measured in this source-only worktree. Capture current table and index sizes for `ArticleCollection`, `User`, and `UserSyncEvent` during an approved release review.
Expected lock type: `CREATE OR REPLACE FUNCTION` and `CREATE TRIGGER` require short catalog locks on `ArticleCollection`; normal collection writes invoke a small same-transaction journal insert after release.
Rewrite or scan risk: No existing rows are read, rewritten, deleted, or backfilled. The migration changes only future collection writes and adds no index, foreign key, or column.
Expected duration: Fast in a disposable PostgreSQL rehearsal. Production duration is not estimated from this worktree and depends on catalog activity and the approved lock window.
Online-safe strategy: Additive trigger only. Use the approved release procedure with a fresh lock timeout and active-transaction review; stop rather than wait behind a blocking transaction.
Backfill plan: None. Existing collections are not journaled retroactively. The later truthful bootstrap path is responsible for an authoritative collection list when a client has no applicable incremental history.
Validation plan: The hash-bound migration-risk checker reports no classifier findings; typed collection event contract tests and the full source suite pass. A disposable PostgreSQL rehearsal must verify insert/update/delete event payloads, cascaded collection-item suppression, and user-deletion suppression before an approved production release.
Maintenance mode required: No, provided the migration acquires its short catalog lock inside the approved lock timeout.
Rollback feasibility: High before collection events are consumed because the change is additive. After release, prefer disabling the mobile sync feature or a separately reviewed forward migration over dropping journal evidence during an incident.
Forward-recovery plan: If application fails, inspect the migration state plus the named function and trigger before retrying. Do not blindly rerun a partial migration; preserve any created journal events and use a reviewed forward repair.
Backup evidence ID requirement: The approved release must capture the exact fresh structured backup evidence ID before any migration execution.
Approver: Not granted for production execution. A later release requires the exact `DEPLOY <short-sha>` approval after normal gates.
Approval timestamp: Not recorded because production ready is false.
Production ready: false
Production result: Not executed. This record covers checked-in migration SQL and local verification only.

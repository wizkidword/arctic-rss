# Migration risk record: externalize mobile sync retention

Migration name: `20260811140000_move_mobile_sync_retention_to_maintenance`
Migration SQL SHA-256: `f3acd6fb5deecfa3b7b167d582e40ebfc281dadbc9285ac586fc490af6c1cf03`
Author/date: Sixth-pass Phase 5 implementation; 2026-08-11
Affected tables: No table definition changes. The migration replaces only the `append_user_sync_event` PostgreSQL function that source-table triggers call to append `UserSyncEvent` rows.
Measured row counts: Not measured in this isolated worktree. Capture current `UserSyncEvent` and `UserSyncCursorFloor` counts during an approved release review before evaluating retention backlog.
Measured table and index sizes: Not measured in this isolated worktree. Capture current table, index, and oldest-event evidence during an approved release review.
Expected lock type: `CREATE OR REPLACE FUNCTION` takes a short catalog lock on the named function. It does not take a data lock on `UserSyncEvent` or the source tables beyond concurrent trigger calls executing the prior or replacement function.
Rewrite or scan risk: No existing row is rewritten, scanned, deleted, or backfilled by this migration. The migration removes the unbounded per-user retention delete from future trigger executions only.
Expected duration: Fast in a disposable PostgreSQL rehearsal. Production duration is not estimated from this worktree and depends on catalog activity and lock availability.
Online-safe strategy: Apply only through the approved release procedure after fresh active-transaction and lock-wait review. Release the matching lease-protected worker code in the same approved application rollout so normal bounded retention resumes outside request writes. Stop rather than queue behind a blocking transaction.
Backfill plan: None. Existing journal rows remain unchanged. The new worker process removes at most its configured expired batch per successful maintenance interval and advances every affected cursor floor in the same transaction.
Validation plan: The hash-bound migration-risk checker reported no classifier findings after this record was added; Prisma validation/client generation, TypeScript validation, unit retention tests, and a CI-only PostgreSQL test must pass. Before an approved production release, rehearse all migrations on disposable PostgreSQL and capture fresh lock, active-transaction, catalog, backup, retained-row, oldest-event, and cursor-floor evidence.
Maintenance mode required: No special deploy-time maintenance mode is required for this function replacement. The normal lease-protected maintenance worker must remain enabled afterward; it reports bounded prune batches, retained-event count, oldest retained age and timestamp, and users still requiring pruning without logging user identifiers.
Rollback feasibility: Moderate. Restoring the previous function would put retention cleanup back on ordinary user writes and is therefore not an acceptable routine rollback. If the worker process has a fault, retain journal evidence, leave the append-only function in place, and use a separately reviewed forward repair or an operator-resumed bounded maintenance pass.
Forward-recovery plan: If function replacement fails, inspect the migration state and exact `append_user_sync_event` definition before retrying. If the worker cannot prune, retain all journal rows and diagnose its lease, database timeout, and low-cardinality maintenance logs; do not add ad hoc trigger-side deletion.
Backup evidence ID requirement: The approved release must capture the exact fresh structured backup evidence ID before any migration execution.
Approver: Not granted for production execution. A later release requires the exact `DEPLOY <short-sha>` approval after all normal gates.
Approval timestamp: Not recorded because production ready is false.
Production ready: false
Production result: Not executed. This record covers checked-in migration SQL and local source verification only.

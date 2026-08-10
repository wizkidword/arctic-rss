# Migration risk record: subscription reverse indexes

Migration name: `20260809153000_add_subscription_reverse_indexes`
Migration SQL SHA-256: `8eff8f7ff3140eb92f29b06323a8072bac112aedac3a670c701ae67f20fe7aa0`
Author/date: Fifth-pass implementation; 2026-08-09
Affected tables: `FeedSubscription`; `PodcastSubscription`
Measured row counts: Not measured in this worktree; obtain current production counts only during an approved release review.
Measured table and index sizes: Not measured in this worktree; obtain current production table and index sizes only during an approved release review.
Expected lock type: PostgreSQL `CREATE INDEX CONCURRENTLY` takes a `SHARE UPDATE EXCLUSIVE` table lock while the index builds. It permits ordinary reads and writes, but still needs a bounded lock wait and workload review.
Rewrite or scan risk: Each index performs a full scan of its subscription table and a second validation pass. It is additive and does not rewrite, delete, or update rows.
Expected duration: Depends on current production row counts, table sizes, I/O, and concurrent write volume. A disposable PostgreSQL 17.10 rehearsal applied all 51 migrations successfully; production duration is not estimated from this worktree.
Online-safe strategy: The committed migration uses PostgreSQL `CREATE INDEX CONCURRENTLY` so feed and podcast subscriptions remain readable and writable. Run through the approved release procedure with a fresh lock-timeout and activity review; do not substitute a regular `CREATE INDEX`.
Backfill plan: None. Both indexes are built from existing subscription rows by PostgreSQL without application or data backfill.
Validation plan: Passed the migration-risk checker and a disposable PostgreSQL 17.10 rehearsal that applied all 51 migrations, exposed both named btree indexes, and used `FeedSubscription_feedId_idx` for a 10,000-row subscriber-count `EXPLAIN (ANALYZE, BUFFERS)` query. Before an approved release, capture fresh `pg_stat_user_tables`, `pg_relation_size`, active-transaction, invalid-index, and `EXPLAIN (ANALYZE, BUFFERS)` evidence for the subscriber-count and orphan lookup shapes before switching the release to ready.
Maintenance mode required: No, provided the concurrent build obtains its lock inside the approved lock-timeout. Stop rather than queue behind an active transaction.
Rollback feasibility: High. The indexes are additive and application behavior does not depend on them for correctness. Remove an unused completed index only through a separately approved `DROP INDEX CONCURRENTLY` operation; do not roll back by deleting source data.
Forward-recovery plan: If a concurrent build fails, inspect `pg_index.indisvalid` for the named index, resolve the blocking condition, drop only the invalid named index with `DROP INDEX CONCURRENTLY`, then rerun the approved release procedure. Do not retry a failed migration blindly.
Backup evidence ID requirement: The approved release must capture the exact fresh structured backup evidence ID before any migration execution.
Approver: Not granted for production execution. A later release requires the exact `DEPLOY <short-sha>` approval after the normal gates.
Approval timestamp: Not recorded because production ready is false.
Production ready: false
Production result: Not executed. This record covers checked-in concurrent index SQL and local verification only.

## Intended reverse lookup coverage

- `FeedSubscription.feedId`: shared-feed subscriber counts, feed orphan checks,
  source replacement safety, and shared-source checks.
- `PodcastSubscription.podcastId`: podcast subscriber counts and podcast orphan
  checks.

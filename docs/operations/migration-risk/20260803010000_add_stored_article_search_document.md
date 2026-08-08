# Migration risk record: stored article search document

Migration name: `20260803010000_add_stored_article_search_document`
Author/date: Historical migration; retrospective recorded 2026-08-08
Affected tables: `Article`; its full-text search index
Estimated row counts: Not recorded in the checked-in evidence; measure before any equivalent production change.
Estimated table and index sizes: Not recorded in the checked-in evidence; measure before any equivalent production change.
Expected lock type: `ALTER TABLE ... ADD COLUMN ... GENERATED ... STORED` can require an ACCESS EXCLUSIVE lock; ordinary `CREATE INDEX` can block writers.
Rewrite or scan risk: Yes. PostgreSQL must evaluate the stored generated expression for existing rows, and the GIN index build scans the resulting column.
Expected duration: Not recorded for production; dependent on Article row count, body size, storage throughput, and concurrent write load.
Online-safe strategy: For a future equivalent change, use an expand path with a nullable or parallel search structure, backfill in bounded batches, build the index concurrently through a controlled non-transactional path, validate, switch the application, then contract only after evidence.
Backfill plan: This historical migration embeds the generated-column population in the schema operation. A future equivalent must use resumable, throttled batches with progress evidence rather than an opaque migration transaction.
Validation plan: Confirm the expected column expression, valid GIN index, representative search plans, Prisma migration history, application compatibility, and post-release error/latency signals.
Maintenance mode required: Yes for a future equivalent unless a rehearsal proves an online-safe staged procedure for the measured production table.
Rollback feasibility: Schema rollback is not assumed safe after an incompatible application release or data rewrite.
Forward-recovery plan: Keep a compatible application version available; if the index or expression is invalid, use a separately reviewed repair migration after verifying backup and schema state.
Backup evidence required: Fresh, verified, off-host PostgreSQL backup evidence before any future production execution.
Owner approval: Retrospective only; a fresh owner approval is required before any equivalent production migration.
Production result: Not verified from current production evidence in this worktree; this record makes no deployed-state claim.

## Classifier disposition

The migration is intentionally flagged for a stored generated column and a
non-concurrent index. The later `DROP INDEX` and rename are also incompatible
with a casual rollback assumption. It is retained as a historical Prisma
migration; it must not be rerun or rolled back merely to satisfy this review.

## Future expand-and-contract sequence

1. Add a parallel nullable/search structure in an expand release.
2. Backfill bounded batches with a resumable cursor, throttling, and progress
   measurements outside the Prisma migration transaction.
3. Build and validate the new index through the approved controlled path when
   PostgreSQL requires `CONCURRENTLY`.
4. Deploy the compatible application read/write switch and verify representative
   search plans.
5. Contract old structures only after backup, usage, and recovery evidence.

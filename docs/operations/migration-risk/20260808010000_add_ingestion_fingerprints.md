# Migration risk record: ingestion fingerprints

Migration name: `20260808010000_add_ingestion_fingerprints`
Migration SQL SHA-256: `2bc878b0f694865ae77250241201de7e583c8e285bb3e3e0fa2d205a21ade25f`
Author/date: Fourth-pass implementation; 2026-08-08
Affected tables: `Article`; `PodcastEpisode`
Measured row counts: Not measured in this worktree; obtain current production counts only during an approved release review.
Measured table and index sizes: No index is added. Existing table sizes were not measured because this work does not authorize production access.
Expected lock type: PostgreSQL `ALTER TABLE ... ADD COLUMN` takes a brief ACCESS EXCLUSIVE metadata lock.
Rewrite or scan risk: No. Both columns are nullable, have no default, no generated expression, no constraint, and no index; PostgreSQL does not need to rewrite or scan existing rows.
Expected duration: Metadata-only in the disposable PostgreSQL rehearsal; measure production lock wait and table size only during an approved release review.
Online-safe strategy: Expand-only compatible release. The application writes a fingerprint for new rows and lazily supplies one only when an existing row is already updated by a normal refresh. No schema-transaction backfill is performed.
Backfill plan: No proactive backfill. Legacy null values are intentionally handled as changed once, then remain stable on later identical refreshes.
Validation plan: Passed on a disposable loopback PostgreSQL 17.10 container: all migrations applied, two first-refresh inserts generated 2,192 WAL bytes, the identical refresh made zero item writes and added zero WAL bytes, and two corrections generated 336 WAL bytes.
Maintenance mode required: No for the nullable expand migration itself, subject to the owner reviewing measured lock wait and table size before production.
Rollback feasibility: High at the application level because both old and new applications tolerate nullable columns. Do not drop populated columns as an emergency rollback step.
Forward-recovery plan: Keep the compatible application release available. If a fingerprint defect is found, deploy a reviewed application correction; do not run an unbounded SQL update.
Backup evidence ID requirement: The approved release must capture the exact fresh structured backup evidence ID before any migration execution.
Approver: Not granted for production execution. A later release requires the exact `DEPLOY <short-sha>` approval after the normal gates.
Approval timestamp: Not recorded because production ready is false.
Production ready: false
Production result: Not executed. This record covers checked-in migration SQL only.

## SQL evidence

- The machine-checked `Migration SQL SHA-256` field above is calculated from the
  committed UTF-8 migration SQL.
- Classifier expectation: no recognized high-risk pattern; the record is retained because even a metadata change needs an explicit production lock and rollback decision.

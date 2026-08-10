# Migration risk record: external identity hash expansion

Migration name: `20260809150000_add_external_identity_hashes`
Migration SQL SHA-256: `6440abf6d28075a5ade6a6b994e2e27246c612a2492975c138dc4eb15b5e5f00`
Author/date: Fifth-pass implementation; 2026-08-09
Affected tables: `Article`; `PodcastEpisode`
Measured row counts: Not measured in this worktree; obtain current production counts only during an approved release review.
Measured table and index sizes: No index is added. Existing table and index sizes were not measured because this work does not authorize production access.
Expected lock type: PostgreSQL `ALTER TABLE ... ADD COLUMN` takes a brief ACCESS EXCLUSIVE metadata lock for each table.
Rewrite or scan risk: No. Both columns are nullable, have no default, no generated expression, no constraint, and no index; PostgreSQL does not need to rewrite or scan existing rows.
Expected duration: Metadata-only in a disposable PostgreSQL rehearsal; measure production lock wait and table size only during an approved release review.
Online-safe strategy: Expand-only compatible release. New and normally changed rows dual-write a SHA-256 identity hash while the existing bounded raw-ID uniqueness remains authoritative until separately approved backfill, index, and switch releases.
Backfill plan: No schema-transaction backfill. A separate resumable, loopback/disposable-safe backfill will populate legacy null hashes and measure collision candidates before any index release.
Validation plan: Passed migration-risk verification, Prisma schema generation, the article/podcast dual-write tests, and a fresh loopback-only PostgreSQL 17.10 rehearsal that applied all 48 committed migrations and verified exactly the two nullable hash columns. Before production execution, capture fresh server-version, lock-wait, row-count, table-size, index-size, and backup evidence.
Maintenance mode required: No for the nullable expand migration itself, subject to the owner reviewing fresh production lock and workload evidence before release.
Rollback feasibility: High at the application level because old and new application versions tolerate nullable columns. Do not drop populated columns as an emergency rollback step.
Forward-recovery plan: If either metadata lock cannot be acquired, stop and retry only through the approved release procedure after investigating active transactions. If the hash writer is defective, deploy a reviewed application correction and retain raw-ID compatibility; do not run an unbounded SQL update.
Backup evidence ID requirement: The approved release must capture the exact fresh structured backup evidence ID before any migration execution.
Approver: Not granted for production execution. A later release requires the exact `DEPLOY <short-sha>` approval after the normal gates.
Approval timestamp: Not recorded because production ready is false.
Production ready: false
Production result: Not executed. This record covers checked-in migration SQL and local verification only.

## SQL evidence

- The machine-checked `Migration SQL SHA-256` is calculated from the committed
  UTF-8 migration SQL with line-ending normalization.
- Classifier expectation: no recognized high-risk pattern; the record is
  retained because metadata locks and follow-on identity-index stages require
  explicit production decisions.

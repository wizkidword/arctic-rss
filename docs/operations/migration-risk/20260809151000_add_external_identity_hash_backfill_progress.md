# Migration risk record: external identity hash backfill progress

Migration name: `20260809151000_add_external_identity_hash_backfill_progress`
Migration SQL SHA-256: `734f806bcfcf02c243a97ec925c83e53c99bdf9b340af236e00b021985c9d9d4`
Author/date: Fifth-pass implementation; 2026-08-09
Affected tables: New `ExternalIdentityHashBackfillProgress` table only
Measured row counts: Not applicable to the new empty progress table. Production article and episode row counts remain unmeasured because this work does not authorize production access.
Measured table and index sizes: No existing table or index is modified. Production source-table sizes must be captured during an approved backfill review.
Expected lock type: PostgreSQL takes catalog and new-table creation locks only; no existing `Article` or `PodcastEpisode` table is altered.
Rewrite or scan risk: No. The migration creates a new empty table and does not scan, update, constrain, or index existing source rows.
Expected duration: Fast in a disposable PostgreSQL rehearsal. Measure production catalog-lock wait only during an approved release review.
Online-safe strategy: Add the isolated progress table before invoking the separately guarded, bounded backfill. The existing nullable identity columns and raw-ID uniqueness remain unchanged.
Backfill plan: The checked-in command requires an explicit disposable confirmation and loopback database URL, processes at most one bounded batch per scope by default, stores an ID checkpoint after each transactional batch, and emits count-only collision candidates.
Validation plan: Passed migration-risk verification, Prisma schema generation, the guarded backfill unit tests, and a fresh loopback-only PostgreSQL 17.10 fixture that applied all 49 migrations, processed synthetic article and episode rows in one-record batches, resumed from both stored checkpoints, and verified three 64-character hashes plus two completed progress rows. Before production execution, obtain owner approval for a production-capable workflow; this command itself refuses non-loopback endpoints.
Maintenance mode required: No for the new-table migration or disposable rehearsal. Any future approved production-capable backfill requires fresh runtime, lock, backup, and batch-size evidence.
Rollback feasibility: High at the application level because the table is used only by the new backfill command. Do not drop populated progress evidence during an incident; pause the command and preserve checkpoints.
Forward-recovery plan: Resume from the stored per-scope cursor after a transient failure. If collision candidates are observed, do not create hash uniqueness indexes or switch lookups until the source rows are reviewed under a separate owner-approved plan.
Backup evidence ID requirement: Any future production-capable backfill requires the exact fresh structured backup evidence ID before it starts.
Approver: Not granted for production execution. A later release requires the exact `DEPLOY <short-sha>` approval after the normal gates and a separately approved production-capable backfill design.
Approval timestamp: Not recorded because production ready is false.
Production ready: false
Production result: Not executed. This record covers checked-in migration SQL and local verification only.

## SQL evidence

- The machine-checked `Migration SQL SHA-256` is calculated from the committed
  UTF-8 migration SQL with line-ending normalization.
- Classifier expectation: no recognized high-risk pattern; this migration only
  creates a new progress table and cannot itself backfill or index source rows.

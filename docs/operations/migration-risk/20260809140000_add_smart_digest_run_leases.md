# Migration risk record: add Smart Digest run leases

Migration name: `20260809140000_add_smart_digest_run_leases`
Migration SQL SHA-256: `92ed7feeda0059779cdf1fe026f1d23ad005203929689143dbe8e3b3c4c94daf`
Author/date: Fifth-pass implementation; 2026-08-09
Affected tables: `DigestRun` and `SmartDigest`
Measured row counts: A disposable PostgreSQL rehearsal is required before this change is considered source-validated; production `DigestRun` and `SmartDigest` row counts must be captured during an approved release review.
Measured table and index sizes: A disposable PostgreSQL rehearsal does not require material sizes; production table and index sizes must be captured before any later foreign-key validation.
Expected lock type: `ALTER TABLE ... ADD COLUMN` takes a brief ACCESS EXCLUSIVE metadata lock. The two regular index builds scan their tables and can block concurrent writes while building. The foreign key is added `NOT VALID`, so it does not validate existing rows in this migration.
Rewrite or scan risk: The nullable fields and defaulted integer are expand-only with no data backfill. Both indexes scan their target tables. Existing rows retain the legacy `DigestRun.digestId` relationship; `SmartDigest.runId` stays null until compatible workers write it.
Expected duration: Fast in the disposable PostgreSQL rehearsal. Measure production table/index size and lock wait before an approved execution.
Online-safe strategy: Expand first, retain `digestId`, add the reverse `runId` uniqueness boundary, and switch only compatible workers to fenced claims in a later commit. Validate the `NOT VALID` foreign key in a separately measured migration; do not remove compatibility fields or indexes in this release.
Backfill plan: No backfill. Existing completed and in-flight runs retain `digestId`; newly created digests receive `runId` once the compatible worker is deployed.
Validation plan: Apply all migrations to a disposable PostgreSQL 17.10 fixture, assert the ownership columns, `runId` unique index, active-lease index, and unvalidated foreign key, then run the Smart Digest stale-worker reclaim/finalization fixture. Before production execution, capture fresh server-version, lock-wait, table-size, active-run, and backup evidence.
Maintenance mode required: No for the disposable rehearsal. Decide only from fresh production lock and workload evidence during an approved release review; a low-write window may be required for material table indexes.
Rollback feasibility: High at the application level before compatible workers write lease fields and `runId`. Once new workers rely on `runId`, keep both relationship paths active and repair forward; do not drop the unique index or reverse column during an incident.
Forward-recovery plan: If an index cannot acquire its lock, stop and retry only through the approved release procedure after investigating active transactions. If a compatible worker fails after creating a digest, recover it through the retained `runId` boundary and leave the legacy `digestId` path intact.
Backup evidence ID requirement: The approved release must capture the exact fresh structured backup evidence ID before any migration execution.
Approver: Not granted for production execution. A later release requires the exact `DEPLOY <short-sha>` approval after the normal gates.
Approval timestamp: Not recorded because production ready is false.
Production ready: false
Production result: Not executed. This record covers checked-in migration SQL and local verification only.

## SQL evidence

- The machine-checked `Migration SQL SHA-256` is calculated from the committed
  UTF-8 migration SQL with line-ending normalization.
- Classifier expectation: review both regular index builds and the table-locking
  metadata changes; the `NOT VALID` foreign key is intentionally deferred for
  separate production validation.

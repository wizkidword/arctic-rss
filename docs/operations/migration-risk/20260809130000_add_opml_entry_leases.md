# Migration risk record: add OPML entry leases

Migration name: `20260809130000_add_opml_entry_leases`
Migration SQL SHA-256: `ba1abb13317cd3290cc66bce19598209a6c77c1167caa2ad88964dbd034012ad`
Author/date: Fifth-pass implementation; 2026-08-09
Affected tables: `ImportJobEntry` and the `ImportEntryStatus` enum
Measured row counts: A disposable PostgreSQL rehearsal is required before this change is considered source-validated; production row counts and active-import count must be captured during an approved release review.
Measured table and index sizes: A disposable PostgreSQL rehearsal does not require material sizes; production table and index sizes must be captured during an approved release review.
Expected lock type: `ALTER TABLE ... ADD COLUMN` takes a brief ACCESS EXCLUSIVE metadata lock. `ALTER TYPE ... ADD VALUE` takes the catalog lock required to append an enum label. The new index is created with a regular PostgreSQL `CREATE INDEX`, which scans `ImportJobEntry` and can block concurrent writes while it builds.
Rewrite or scan risk: The nullable lease columns and defaulted integer are expand-only. The index build scans `ImportJobEntry`; no row rewrite, data backfill, or status conversion occurs in this migration.
Expected duration: Fast in the disposable PostgreSQL rehearsal. Measure production table/index size and lock wait before an approved execution.
Online-safe strategy: Expand the schema first, retain existing terminal entry values, then switch only compatible workers to fenced claims. Do not remove compatibility fields or indexes in this release.
Backfill plan: No backfill. Existing pending entries are claimed with attempt one after the compatible worker is deployed; existing terminal entries remain unchanged.
Validation plan: Apply all migrations to a disposable PostgreSQL 17.10 fixture, assert the enum and index, run the PostgreSQL stale-worker reclaim/finalization test, and verify bounded counter invariants. Before production execution, capture fresh server-version, lock-wait, table-size, active-import, and backup evidence.
Maintenance mode required: No for the disposable rehearsal. Decide only from fresh production lock and workload evidence during an approved release review; a low-write window may be required for a material `ImportJobEntry` table.
Rollback feasibility: High at the application level while no worker writes `PROCESSING`. After compatible workers begin writing that value, keep them active; do not remove an enum value or lease columns during an incident.
Forward-recovery plan: If the index cannot acquire its lock, stop and retry only through the approved release procedure after investigating active transactions. If a prior worker encounters `PROCESSING`, keep the new worker active and repair forward from the retained entry checkpoints.
Backup evidence ID requirement: The approved release must capture the exact fresh structured backup evidence ID before any migration execution.
Approver: Not granted for production execution. A later release requires the exact `DEPLOY <short-sha>` approval after the normal gates.
Approval timestamp: Not recorded because production ready is false.
Production ready: false
Production result: Not executed. This record covers checked-in migration SQL and local verification only.

## SQL evidence

- The machine-checked `Migration SQL SHA-256` is calculated from the committed
  UTF-8 migration SQL with line-ending normalization.
- Classifier expectation: review the regular index build and enum catalog lock;
  both remain owner-gated for production.

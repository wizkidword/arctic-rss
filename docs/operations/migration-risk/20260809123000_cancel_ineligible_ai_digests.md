# Migration risk record: cancel ineligible AI digests

Migration name: `20260809123000_cancel_ineligible_ai_digests`
Migration SQL SHA-256: `bb7b028457c5006ec0e814e881eaf0be58cff4018c495801aa9f17aaf973dc87`
Author/date: Fifth-pass implementation; 2026-08-09
Affected tables: `AiDigest` enum type only; no table rows are rewritten by this migration
Measured row counts: A disposable PostgreSQL rehearsal is required before this change is considered source-validated; production row counts must be captured during an approved release review.
Measured table and index sizes: A disposable PostgreSQL rehearsal does not require material sizes; production table and index sizes must be captured during an approved release review.
Expected lock type: PostgreSQL `ALTER TYPE ... ADD VALUE` takes the catalog lock needed to add the enum label; it does not rewrite `AiDigest` rows.
Rewrite or scan risk: No table rewrite, index build, scan, or data backfill is included. Existing enum values and rows remain compatible with the previous worker.
Expected duration: Fast in the disposable PostgreSQL rehearsal. Production lock wait and server version must be confirmed before an approved execution.
Online-safe strategy: Expand only by appending `CANCELED`; deploy compatible code that treats it as terminal and does not resume it. Do not remove values or change existing data in this migration.
Backfill plan: No backfill. Account-disable transactions write `CANCELED` only for active or retryable AI digests after the new code is deployed.
Validation plan: Apply all migrations to a disposable PostgreSQL 17.10 fixture, assert the `AiDigestStatus` enum includes `CANCELED`, run AI-digest cancellation tests, and verify the worker build. Before production execution, capture fresh server-version, lock-wait, table-size, and backup evidence.
Maintenance mode required: No for the disposable rehearsal. Decide only from fresh production lock and workload evidence during an approved release review.
Rollback feasibility: High at the application level because the previous worker may not recognize the new terminal value. Do not attempt enum-value removal during an incident; keep compatible code active and use a reviewed forward repair.
Forward-recovery plan: If the enum change cannot acquire its lock, stop and retry only through the approved release procedure after investigating active transactions. If an older worker encounters a new terminal value, keep the new worker active and correct forward rather than removing the enum value.
Backup evidence ID requirement: The approved release must capture the exact fresh structured backup evidence ID before any migration execution.
Approver: Not granted for production execution. A later release requires the exact `DEPLOY <short-sha>` approval after the normal gates.
Approval timestamp: Not recorded because production ready is false.
Production ready: false
Production result: Not executed. This record covers checked-in migration SQL and local verification only.

## SQL evidence

- The machine-checked `Migration SQL SHA-256` is calculated from the committed
  UTF-8 migration SQL with line-ending normalization.
- Classifier expectation: no automated finding. Adding one PostgreSQL enum
  value is nevertheless an operational catalog-lock decision and remains
  owner-gated for production.

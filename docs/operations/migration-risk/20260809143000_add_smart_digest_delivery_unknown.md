# Migration risk record: add Smart Digest delivery-unknown state

Migration name: `20260809143000_add_smart_digest_delivery_unknown`
Migration SQL SHA-256: `c73eb3b40021155e8c2d616f18b03eb3c302bed95df7fca80d434bdcad2dddb1`
Author/date: Fifth-pass implementation; 2026-08-09
Affected tables: `SmartDigest` through the `SmartDigestEmailStatus` enum
Measured row counts: A disposable PostgreSQL rehearsal is required before this change is considered source-validated; production Smart Digest row count and active email-delivery count must be captured during an approved release review.
Measured table and index sizes: No table/index rewrite is expected. Production enum and application-version compatibility must be checked during an approved release review.
Expected lock type: PostgreSQL takes the catalog lock required to append an enum label; existing enum labels and rows are retained.
Rewrite or scan risk: No table rewrite, scan, backfill, index build, or status conversion occurs. The application begins writing the new value only after compatible code is deployed.
Expected duration: Fast in the disposable PostgreSQL rehearsal. Verify production lock wait and active deployment workload before an approved execution.
Online-safe strategy: Add the enum label first, retain all existing delivery states, then switch compatible delivery workers to `DELIVERY_UNKNOWN`. Do not remove or rename an enum label in this release.
Backfill plan: No backfill. Existing `PROCESSING` rows retain their conservative no-resend behavior and remain inspectable by the reconciliation command.
Validation plan: Apply all migrations to a disposable PostgreSQL 17.10 fixture, verify `DELIVERY_UNKNOWN` is present, and run the SMTP-accepted/database-acknowledgement-failure plus reconciliation tests. Before production execution, capture fresh server-version, lock-wait, active-delivery, and backup evidence.
Maintenance mode required: No for the disposable rehearsal. Decide only from fresh production lock and workload evidence during an approved release review.
Rollback feasibility: High at the application level before compatible workers write the new value. After writes begin, keep compatible workers active; do not remove an enum value during an incident.
Forward-recovery plan: If the enum change cannot acquire its catalog lock, stop and retry only through the approved release procedure after investigating active transactions. If a delivery acknowledgement is uncertain, preserve the provider message ID and use explicit reconciliation rather than resending.
Backup evidence ID requirement: The approved release must capture the exact fresh structured backup evidence ID before any migration execution.
Approver: Not granted for production execution. A later release requires the exact `DEPLOY <short-sha>` approval after the normal gates.
Approval timestamp: Not recorded because production ready is false.
Production ready: false
Production result: Not executed. This record covers checked-in migration SQL and local verification only.

## SQL evidence

- The machine-checked `Migration SQL SHA-256` is calculated from the committed
  UTF-8 migration SQL with line-ending normalization.
- Classifier expectation: the append-only enum change is reviewed for catalog
  lock timing and application-version compatibility.

# Migration risk record: stable device receipt and installation ownership

Migration name: 20260811120000_add_mobile_device_owned_records
Migration SQL SHA-256: 2ccbccce42057c26a922267034552e95f65bf9a60ab1a89237925cfdc1486b9b
Author/date: Sixth-pass Phase 3 source implementation, reviewed 2026-08-11
Affected tables: DeviceMutationReceipt and DeviceInstallation gain nullable mobileDeviceId, deterministic backfills from DeviceSession, indexes, uniqueness, and MobileDevice foreign keys.
Measured row counts: Fresh disposable PostgreSQL 17.10 rehearsal started empty and applied all 58 committed migrations; production receipt/installation/session counts are intentionally not represented here.
Measured table and index sizes: Fresh disposable fixture contained only migrated schema; capture production DeviceMutationReceipt, DeviceInstallation, DeviceSession, and index sizes before an approved release.
Expected lock type: ALTER TABLE ADD COLUMN, two UPDATE backfills, CREATE INDEX/CREATE UNIQUE INDEX, and two foreign-key validations take locks; foreign keys can scan existing receipt/installation rows and indexes can block writes.
Rewrite or scan risk: Each UPDATE scans existing receipt or installation rows and writes the nullable stable-device relation. This migration is additive but performs an in-transaction backfill on material tables.
Expected duration: Fast on an empty PostgreSQL 17.10 fixture; production duration depends on receipt/installation volume, session coverage, index build time, and lock contention.
Online-safe strategy: Apply only after approved production lock/active-transaction/table-size/backup evidence. The source retains DeviceSession relations for compatibility; stop rather than wait if a migration lock cannot be obtained inside the reviewed window.
Backfill plan: Populate each record from the owning DeviceSession.mobileDeviceId while preserving legacy DeviceSession ownership. Rehearse multiple token families, long refresh chains, revoked/reuse families, installations, and idempotency receipts before production.
Validation plan: Fresh PostgreSQL 17.10 applied all 58 migrations, migration status was up to date, Prisma diff found no drift, and real PostgreSQL mobile auth/sync tests passed device ownership, receipt replay/conflict, installation cleanup, and sync convergence paths.
Maintenance mode required: No dedicated maintenance mode is selected in source; production execution needs an approved lock-window and forward-repair decision.
Rollback feasibility: Application rollback remains compatible because legacy DeviceSession relations stay present. Do not drop nullable stable-device ownership or uniqueness evidence after use; prefer a reviewed forward repair.
Forward-recovery plan: On partial migration failure, inspect Prisma migration state, nullable ownership backfill counts, indexes, and foreign-key validity before a reviewed retry. Preserve existing receipt/install records and correct forward.
Backup evidence ID requirement: Capture and record the exact fresh production backup evidence ID before any approved production migration.
Approver: Not granted for production execution; exact DEPLOY short SHA approval remains required.
Approval timestamp: Not recorded because production ready is false.
Production ready: false
Production result: Not executed in production; this report records source and disposable-fixture verification only.

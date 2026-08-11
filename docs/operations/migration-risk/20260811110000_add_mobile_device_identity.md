# Migration risk record: stable mobile device identity

Migration name: 20260811110000_add_mobile_device_identity
Migration SQL SHA-256: 8035569a605193646e9871b707747d39d840bd83980a32c9a349f4bce71cb229
Author/date: Sixth-pass Phase 3 source implementation, reviewed 2026-08-11
Affected tables: MobileDevice is added; DeviceSession gains nullable mobileDeviceId; the migration backfills one device per token family and folds family revocation/reuse/expiry state.
Measured row counts: Fresh disposable PostgreSQL 17.10 rehearsal started empty and applied all 58 committed migrations; production DeviceSession/token-family counts are intentionally not represented here.
Measured table and index sizes: Fresh disposable fixture contained only migrated schema; capture production DeviceSession, MobileDevice, and related index sizes before an approved release.
Expected lock type: CREATE TABLE, ALTER TABLE ADD COLUMN, CREATE INDEX, two foreign-key validations, and the backfill UPDATEs take locks; the foreign keys can scan User and DeviceSession and non-concurrent indexes can block writes.
Rewrite or scan risk: The two UPDATE statements scan existing DeviceSession rows and write mobileDeviceId/state-derived MobileDevice rows. This is an in-migration backfill and requires production cardinality/lock evidence before release.
Expected duration: Fast on an empty PostgreSQL 17.10 fixture; production duration depends on token-family chain length, DeviceSession count, indexes, and lock contention.
Online-safe strategy: Do not run this migration until the approved release review captures table counts, index sizes, lock waits, active transactions, and backup evidence. Use the reviewed dual-read compatibility source and stop on blocking locks rather than extending the transaction.
Backfill plan: Deterministically create one stable device per token family from newest session, fold family-wide state, then populate nullable DeviceSession.mobileDeviceId. Validate long refresh chains, revoked/reuse families, installations, and receipts on a representative disposable fixture before production.
Validation plan: Fresh PostgreSQL 17.10 applied all 58 migrations, migration status was up to date, Prisma diff found no drift, and the real mobile-auth integration suite passed device-cap, session-ID revocation, stable-device revocation, concurrent refresh, and account-invalidation coverage.
Maintenance mode required: A dedicated maintenance mode is not selected in source; production execution requires the approved lock window and a decision from the migration risk review.
Rollback feasibility: Application rollback remains compatible while nullable ownership fields and DeviceSession history remain. Do not drop MobileDevice or erase backfilled family evidence; use a reviewed forward repair if needed.
Forward-recovery plan: On partial failure, inspect Prisma migration state and the MobileDevice/DeviceSession relation before retrying. Preserve deterministic backfill results and repair forward with a reviewed idempotent plan.
Backup evidence ID requirement: Capture and record the exact fresh production backup evidence ID before any approved production migration.
Approver: Not granted for production execution; exact DEPLOY short SHA approval remains required.
Approval timestamp: Not recorded because production ready is false.
Production ready: false
Production result: Not executed in production; this report records source and disposable-fixture verification only.

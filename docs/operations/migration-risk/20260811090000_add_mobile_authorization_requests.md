# Migration risk record: mobile authorization requests

Migration name: 20260811090000_add_mobile_authorization_requests
Migration SQL SHA-256: 65c73db9fb69aad1f9ea3c66dc501cf720f880ac001694d36d2df06dd718ce57
Author/date: Sixth-pass Phase 2 source implementation, reviewed 2026-08-11
Affected tables: DeviceAuthorizationCode gains nullable clientId; MobileAuthorizationRequest is added with its user relation and approval/expiry indexes.
Measured row counts: Fresh disposable PostgreSQL 17.10 rehearsal started empty and applied all 58 committed migrations; production row counts are intentionally not represented here.
Measured table and index sizes: Fresh disposable fixture contained only migrated schema; capture production table/index sizes before an approved release.
Expected lock type: ALTER TABLE ADD COLUMN, CREATE TABLE, CREATE INDEX, and foreign-key validation take catalog/table locks; the new foreign key can scan User.
Rewrite or scan risk: No existing application row is rewritten. The nullable DeviceAuthorizationCode column is expand-only; the new relation validation can scan User and indexes can block writes on material target tables.
Expected duration: Fast on the fresh PostgreSQL 17.10 fixture; production duration depends on User cardinality, lock contention, and the approved maintenance window.
Online-safe strategy: Apply only through the approved release procedure after fresh lock/active-transaction evidence. Stop rather than wait behind a blocked lock; no application cutover should assume the new approval record until the matching release is healthy.
Backfill plan: None. Existing authorization codes retain their short-lived behavior and clientId remains nullable for compatibility.
Validation plan: Fresh PostgreSQL 17.10 applied all 58 migrations, migration status was up to date, Prisma diff found no drift, and the real mobile-auth integration suite passed 5 tests including approval/cancel, PKCE, refresh/revocation, device caps, and disablement.
Maintenance mode required: No dedicated maintenance mode, provided the release uses the approved bounded lock window and rollback/forward-repair plan.
Rollback feasibility: High before new authorization requests are used; retain the additive table/column after use and prefer a reviewed forward repair over dropping authorization evidence.
Forward-recovery plan: If migration/application startup fails, inspect the Prisma migration record, MobileAuthorizationRequest table, indexes, and foreign-key state; correct forward without replaying user authorization or deleting approval evidence.
Backup evidence ID requirement: Capture and record the exact fresh production backup evidence ID before any approved production migration.
Approver: Not granted for production execution; exact DEPLOY short SHA approval remains required.
Approval timestamp: Not recorded because production ready is false.
Production ready: false
Production result: Not executed in production; this report records source and disposable-fixture verification only.

# Migration risk record: mobile device authorization and sessions

Migration name: `20260810110000_add_mobile_device_auth`
Migration SQL SHA-256: `5cb8c020dbc752bdbc6194277075ee5db47498a15f238365e8d9273783c4ccb4`
Author/date: Fifth-pass Phase 11 implementation; 2026-08-10
Affected tables: New `DeviceAuthorizationCode` and `DeviceSession` tables; foreign keys reference `User` and `DeviceSession`.
Measured row counts: Not measured in this worktree. The new tables are empty before this release; obtain current `User` counts only during an approved release review.
Measured table and index sizes: Not measured in this worktree. The new tables and their indexes begin empty; obtain current catalog and storage evidence during an approved release review.
Expected lock type: `CREATE TABLE`, unique-index creation on empty new tables, and foreign-key addition take short catalog locks. The `User` foreign key still requires a bounded lock-wait review on the existing account table.
Rewrite or scan risk: No existing rows are read, rewritten, deleted, or backfilled. PostgreSQL creates two new empty tables and their supporting indexes.
Expected duration: Fast in a disposable PostgreSQL rehearsal. Production duration is not estimated from this worktree and depends on catalog activity and lock availability.
Online-safe strategy: Additive schema only. Use the approved release procedure with a fresh lock timeout and active-transaction review; stop rather than queue behind a blocking transaction.
Backfill plan: None. Mobile credentials are created only after the feature is available. Existing web/Auth.js sessions remain unchanged.
Validation plan: Passed the hash-bound migration-risk checker, Prisma client generation, focused device-auth route/contract tests, and a disposable PostgreSQL 17.10 rehearsal that applied all 52 migrations. The real-database Phase 11 suite passed PKCE success/wrong-verifier/replay/expiry/redirect checks, refresh rotation and concurrent reuse revocation, disablement and `authVersion` invalidation, targeted and all-device revocation, and the five-device cap. Before an approved production release, capture fresh lock, active-transaction, catalog, and backup evidence.
Maintenance mode required: No, provided the migration obtains its short catalog locks inside the approved lock timeout.
Rollback feasibility: High before credentials are issued because the tables are additive. After use, do not drop token-family or security evidence during an incident; disable the feature and revoke sessions through the application, then make a separately approved retention decision.
Forward-recovery plan: If migration application fails, inspect the migration state and the named table/index/constraint artifacts before retrying. Do not blindly rerun a partial migration. Preserve any issued session evidence and use a reviewed forward repair.
Backup evidence ID requirement: The approved release must capture the exact fresh structured backup evidence ID before any migration execution.
Approver: Not granted for production execution. A later release requires the exact `DEPLOY <short-sha>` approval after all normal gates.
Approval timestamp: Not recorded because production ready is false.
Production ready: false
Production result: Not executed. This record covers checked-in migration SQL and local verification only.

## Credential-storage boundary

- `DeviceAuthorizationCode.codeHash` and `DeviceSession.refreshTokenHash` store
  SHA-256 digests only; raw codes and refresh tokens are never backfilled or
  persisted in database fields.
- `replacedById` is unique so one refresh row can have at most one successor;
  the runtime uses a conditional transaction update to make a competing use a
  detectable family-revocation event.

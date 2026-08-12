# Migration risk record: authoritative stable-device ownership

Migration name: `20260812090000_make_mobile_device_authoritative`
Migration SQL SHA-256: `94bfcc694a82a8e966d66bea2d1a0fc13a96221ffc49d6c9ee95f015a12beffe`
Author/date: Seventh-pass Phase 2 source implementation; 2026-08-12
Affected tables: `DeviceMutationReceipt`, `DeviceInstallation`, `DeviceSession`, and `MobileDevice`.
Measured row counts: Fresh disposable PostgreSQL rehearsal started empty; production cardinalities must be captured during an approved release review.
Measured table and index sizes: Fresh disposable PostgreSQL rehearsal contained schema only; production table and index sizes must be captured during an approved release review.
Expected lock type: Backfill updates and `SET NOT NULL` can take table locks; the two foreign-key replacements validate existing receipt and installation rows.
Rewrite or scan risk: The migration scans/backfills receipt and installation ownership and validates two foreign keys. It performs no full table rewrite and deletes no business data.
Expected duration: Fast on the empty disposable rehearsal; production duration depends on receipt/installation cardinality and lock contention.
Online-safe strategy: Use only the approved release controller after fresh backup, table-size, active-transaction, and lock-wait evidence. Stop rather than wait behind a blocking transaction.
Backfill plan: Populate stable owner from each source session, reject unmappable or cross-user rows, then apply required ownership and foreign-key constraints.
Validation plan: Fresh PostgreSQL 17.10 applies all committed migrations and real mobile sync integration tests cover receipt replay, conflict, installation ownership, and cleanup. Re-run exact-commit CI and capture production lock evidence before release.
Maintenance mode required: No dedicated maintenance mode is selected; the approved migration lock window is required.
Rollback feasibility: Do not roll back the schema independently. Preserve ownership evidence and use a reviewed forward repair if an approved rollout fails.
Forward-recovery plan: Inspect Prisma migration state and affected owner/session rows, preserve mapped data, and correct forward without guessing a stable device owner.
Backup evidence ID requirement: The approved release must record the exact fresh structured backup evidence ID before migration execution.
Approver: Not granted for production execution; exact `DEPLOY <short-sha>` approval remains required.
Approval timestamp: Not recorded because production ready is false.
Production ready: false
Production result: Not executed in production; this record covers source and disposable-fixture verification only.

## Change

`DeviceMutationReceipt.mobileDeviceId` and `DeviceInstallation.mobileDeviceId`
become required, stable-device ownership. Their rotating
`deviceSessionId` becomes nullable audit context with `ON DELETE SET NULL`.
The stable-device foreign keys use `ON DELETE CASCADE`, so an account deletion
can still remove all device-owned records through `MobileDevice`.

The migration first backfills null stable-device IDs from the source session,
then aborts if any receipt or installation is missing a valid stable device or
has a session/device cross-user mismatch. It never guesses an owner.

## Risk and rollout assessment

| Area | Assessment |
| --- | --- |
| Locking | Backfill updates and `SET NOT NULL` can take table locks; foreign-key replacement validates existing rows. |
| Rewrite/scan | The two owner checks and backfills scan receipt/installation rows; no full table rewrite is expected from nullable session context. |
| Data loss | The migration removes no receipt or installation. It fails before changing constraints if a row cannot be mapped safely. |
| Compatibility | Application source reads/writes stable ownership before the migration removes cascade dependency. The optional session context keeps audit compatibility. |
| Rollback | Do not roll back schema independently. A forward repair should correct any rejected ownership evidence; source rollback remains compatible with optional session IDs only after review. |

## Required pre-production evidence

- Fresh backup evidence and current table/index sizes.
- No long-running transactions or lock waits on the affected tables.
- A representative, isolated upgrade rehearsal with the exact final migration.
- Null-owner, cross-user, duplicate stable-device idempotency, and orphaned
  installation assertions passing.
- Exact-commit CI and the approved release-controller gates.

No production migration or database action is authorized by this document.

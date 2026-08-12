# Migration risk record: authoritative stable-device ownership

Migration name: `20260812090000_make_mobile_device_authoritative`
Migration SQL SHA-256: `94bfcc694a82a8e966d66bea2d1a0fc13a96221ffc49d6c9ee95f015a12beffe`
Production ready: false

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

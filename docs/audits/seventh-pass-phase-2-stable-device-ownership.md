# Seventh-pass Phase 2: stable-device ownership

## Decision

`MobileDevice` is now the sole lifecycle owner for mobile mutation receipts
and installations. A `DeviceSession` represents a refresh-token generation,
not a physical device. Its ID is retained only as optional audit context and
can be cleared when historical refresh rows are deleted.

## Source changes

- Every authenticated mobile write receives the stable device ID from the
  validated access-token principal; request bodies never supply it.
- Idempotency lookup, replay, uniqueness, and receipt creation are scoped to
  the stable device. A supplied session must still belong to that device.
- Installation registration, unregistration, logout, and family revocation
  use the stable device as their lifecycle key.
- Stable-device or family revocation disables all active installations before
  the device is considered revoked.
- The forward-only migration backfills missing stable owners, refuses
  unmappable/cross-user rows, makes stable ownership required, removes the
  session cascade, and retains `deviceSessionId` as nullable `SET NULL` audit
  context.

## Verification target

The PostgreSQL integration scenario passed in a fresh disposable PostgreSQL
17.10 container after all 59 migrations were applied. It creates a device,
completes a mutation and installation registration, rotates the refresh token
twenty times, deletes all predecessor session rows, replays the original
idempotency key, and then revokes the stable device. It verifies that the
receipt and installation survive session-history cleanup and that revocation
disables the installation and final active session.

The later Phase 7 rehearsal records lock, duration, and upgrade measurements.
No production database was touched.

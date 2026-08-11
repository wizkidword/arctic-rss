# Sixth-pass Phase 3 stable-device migration risk

**Status:** expand/backfill source work only; not applied to production.

`20260811110000_add_mobile_device_identity` creates one `MobileDevice` record
per existing refresh-token family and adds nullable `DeviceSession.mobileDeviceId`.
It retains every existing refresh row, token hash, receipt relation, and push
installation relation. The migration deterministically derives a legacy ID for
backfilled rows, then links every row in the family to that device.

No foreign key is made required and no existing relation is removed. A later
reviewed source cutover must dual-read, move receipts/installations, switch
device management and caps to `MobileDevice`, and prove the disposable
PostgreSQL rehearsal before any production deployment.

`20260811120000_add_mobile_device_owned_records` is the next additive
expansion: it backfills nullable device references on receipts and
installations from their already-linked refresh-session rows. Existing unique
keys and foreign keys remain in place until the later dual-write cutover.

New source writes now populate both the stable-device reference and the legacy
session relation. Idempotency lookup prefers the stable device, preserving a
key across refresh rotation; a nullable legacy fallback remains only for rows
not yet backfilled.

# Seventh-pass Phase 10: backup acknowledgement and capacity

**Status:** source policy and dry-run reporter verified; no production backup
or pruning was run.

## Changes

Backup evidence now records both the database-dump and globals-export SHA-256
values. The root-only off-host acknowledgement helper checksum-validates both
local artifacts, requires them to match the evidence record, and atomically
records the opaque target class, acknowledgement time, verification status,
and both checksums.

`src/lib/backup-pruning.ts` is a pure, read-only eligibility model. It rejects
missing/mismatched acknowledgement, unverified catalog, named archive, and
operator/legal hold. It also retains the configured minimum newest recovery
points for each UTC day and requires a newer same-day verified replacement.
`npm run backup:prune:report -- <catalog.json> <maximum-backups-per-day>`
emits only a JSON `dry-run` report; it has no delete capability.

The production backup helper keeps `RETENTION_DAYS=30` and
`MAX_BACKUPS_PER_DAY=0` as defaults. Even if the optional cap is present, the
helper now reports that no automatic pruning occurred. Named recovery archives
remain outside timestamp-backup processing.

## Verification

`npx vitest run scripts/production-backup-evidence.test.ts src/lib/backup-pruning.test.ts` passed: 2 files, 11 tests. The cases cover a missing acknowledgement, invalid checksum, named archive, hold, unverified catalog, newer same-day replacement, and preservation of the newest daily point.

`npm run typecheck` and targeted ESLint passed. Shell syntax was not locally
executed because this Windows workstation has no usable POSIX shell; the
existing scripts require their normal Linux/systemd deployment environment.

## Production boundary

This phase did not inspect, copy, acknowledge, restore, prune, or delete any
production backup. A real report needs a sanitized catalog or an owner-run
private inventory process; deletion remains an owner-controlled operation.

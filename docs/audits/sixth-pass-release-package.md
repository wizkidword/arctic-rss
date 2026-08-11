# Sixth-pass release package

**Status:** source-verification package only. It is not a deployment plan, a
signed Android artifact, or an authorization to release.

## Candidate identity

| Field | Value |
| --- | --- |
| Working branch | codex/sixth-pass-phase-0-1 |
| Verified source revision | 1b93076 |
| Sixth-pass baseline | 8e83e9ee818f8a715fb8c99a5ef81287b2bf0051 |
| Source commits in this closeout sequence | 486a137, 05e9486, 92c7eb7, 1b93076 |
| Production deployment | Not performed |
| Android signed artifact | Not created |
| Play upload | Not performed |

## Included source changes

- Identifier-free operational records for authorization, refresh, sync pages,
  active stable devices, journal retention, API response classes, and marked
  offline queue conflicts.
- Topology-driven monitoring source and an owner-run trusted-ingress proof
  package, without production monitor/ingress changes.
- Owner-only Play handoff material: Data Safety source inventory, privacy
  reconciliation checklist, and signed-device smoke plan.
- Stable device migration-risk reports with exact SQL hashes and fresh
  disposable PostgreSQL application/status/drift evidence.
- A revocation compatibility fix so both settings-managed stable device IDs and
  logout-supplied device session IDs revoke the same owned token family.
- Idempotent cross-process OPML test cleanup.

## Required evidence before any approved production deployment

1. Exact commit CI must pass remotely.
2. Owner must obtain fresh public health and login evidence and local readiness.
3. Owner must capture production migration evidence: backup ID, lock waits,
   active transactions, table/index sizes, and reviewed production backfill
   plan for the three flagged mobile migrations.
4. Owner must select and verify the actual production topology and any
   ingress-proof method separately.
5. Owner must provide the exact approved deployment instruction for the final
   short SHA. Source verification and this package do not substitute for it.

## Required evidence before signed Android / Play action

1. Confirm Play developer account and package ownership.
2. Create/select signing identity; keep certificate SHA-256 outside Git.
3. Produce the exact preview AAB and record source SHA, artifact SHA-256,
   version/versionCode, manifest evidence, target SDK, and signing fingerprint.
4. Publish matching assetlinks.json and verify all App Links on a signed
   device.
5. Complete owner/legal review of the source-backed Data Safety inventory and
   publish accurate privacy/deletion policy text.
6. Execute the signed-device smoke plan with redacted evidence.
7. Obtain fresh owner approval naming the exact artifact and internal track
   before upload.

## Explicitly excluded

- Database migration deployment or production backfill.
- Secret, signing-key, Play Console, EAS credential, or tester-group action.
- Website deployment, OVH mutation, Cloudflare/ingress change, or public probe.
- Any claim that a local unsigned export is a signed or distributable Android
  artifact.

Use the approved release workflow only after the required owner evidence is
present. The package deliberately preserves the distinction between source,
local/disposable verification, deployment, runtime verification, signed build,
and Play publication.

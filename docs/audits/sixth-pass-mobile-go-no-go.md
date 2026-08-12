# Sixth-pass mobile go/no-go

**Decision:** NO-GO for a signed Android internal build, Play internal testing,
and Play production. This is a source-evidence decision, not a release request.

## Current state

| Gate | Source evidence | Current decision | Missing evidence or owner action |
| --- | --- | --- | --- |
| Mobile authorization | Browser PKCE, explicit approval, registered client, and HTTPS callback source are covered by real PostgreSQL tests | Source verified only | A real signing identity and signed-device App Link/authorization proof |
| Session refresh and revocation | Concurrency/refresh/revocation database tests pass; logout now resolves both session and stable-device ownership | Source verified only | Signed-device lifecycle and network-recovery proof |
| Stable device migration | All 58 migrations apply cleanly on fresh PostgreSQL; hash-bound risk reports and real device tests pass | Source verified only | Production-scale table/lock/backup evidence and approved migration window |
| Offline/sync/queue | Local source and real sync tests cover ownership, non-lossy cursor/bootstrap, retention, and queue conflicts | Source verified only | Native SQLite/account-switch/restore failure injection and signed-device proof |
| Android configuration | Expo Doctor, native config, typecheck, lint, audit, SBOM, and unsigned export pass | Source verified only | Exact signed AAB manifest, checksum, target SDK, and signing fingerprint |
| Push | No provider, permission, registration, or selectable mobile push channel | Truthful boundary | Re-review Data Safety and policy before any future provider integration |
| Podcast | Episode browsing, notes, and completion/star state remain available; native playback and listening-progress controls are deliberately deferred | Deferred; not in internal-test scope | Do not claim in-app playback. Revisit only when native audio work is separately approved and tested. |
| Privacy and Data Safety | Source-backed evidence inventory and smoke plan exist | Owner/legal review required | Publish owner/counsel-approved factual policy text and complete exact-artifact Data Safety review |
| Play prerequisites | Owner checklist is documented | Owner action required | Developer account, package ownership, EAS project/credentials, signing identity, tester group, listing, track approval |

## GO rules

### Signed internal Android build

**NO-GO.** It may become GO only after all source gates remain green and the
owner supplies a real signing identity, exact package ownership, approved EAS
credentials, a signed preview AAB, artifact SHA-256, target-SDK/permission/
backup/network inspection, valid App Link assetlinks proof, privacy-policy
reconciliation, and signed-device smoke results.

### Play internal testing

**NO-GO.** It additionally requires an owner-reviewed Data Safety declaration,
public privacy/deletion URLs verified from the signed candidate, a selected
internal tester group, exact-artifact approval naming the track, and successful
signed-device smoke evidence.

### Play production

**NO-GO.** It additionally requires applicable closed-testing completion,
crash/ANR review, stable real-device auth/sync/account-switch/restore evidence,
truthful store listing, no unresolved P0/P1, explicit acceptance of any
non-misleading P2 deferrals, and explicit owner approval.

## Evidence links

- docs/mobile/google-play-data-safety-evidence.md
- docs/mobile/android-signed-device-smoke-plan.md
- docs/mobile/google-play-readiness.md
- docs/audits/sixth-pass-capability-status.md
- docs/audits/sixth-pass-completion-report.md

No step in this document authorizes signing, upload, tester invitation, or
production deployment.

# Sixth-pass capability status

**Baseline SHA:** `8e83e9ee818f8a715fb8c99a5ef81287b2bf0051`
**Scope:** source work in a clean isolated worktree. No website deployment or
Play action is represented by this ledger.

| ID | Status | Current evidence and next gate |
| --- | --- | --- |
| MOB-AUTH-001 | IN_PROGRESS | Phase 2 source now registers `android:com.arcticrss.reader`, accepts the exact HTTPS callback in production, creates a server-stored one-time approval request on GET, and issues a code only after explicit approve POST. The feature remains default-off. Recent-auth proof, real signing/App Link verification, disposable-DB migration rehearsal, and owner enablement remain open. |
| MOB-BODY-001 | SOURCE_VERIFIED | Phase 1 adds a shared 8 KiB/5 s JSON reader, media/encoding/UTF-8/JSON checks, IP-only pre-body limits, secret-specific post-body limits, generic errors, OpenAPI codes, and focused/full-suite evidence. No deployment is implied. |
| MOB-REFRESH-001 | SOURCE_VERIFIED | Phase 3 source serializes Android refresh callers behind one promise, writes a single validated v2 bundle before publishing it, retains the old bundle for retryable failures, clears terminal failures once, and permits one coordinated API-401 replay. Device-bound bundle fields await MOB-DEVICE-001. |
| MOB-DEVICE-001 | IN_PROGRESS | Phase 3 adds an expand/backfill `MobileDevice` model and nullable `DeviceSession.mobileDeviceId`, retaining refresh history. Dual-read source cutover, stable caps/management, receipt and installation ownership, cleanup, and disposable-PostgreSQL rehearsal remain open. |
| MOB-OFFLINE-001 | IN_PROGRESS | Phase 4 source adds mandatory SQLite user/device owner metadata and purges unowned or switched-account data before sync. A hidden authenticated route group prevents protected screens from mounting while signed out and only restores recognized in-app paths after sign-in. The one-time alpha cache reset introduces SQLite schema versioning, transactional cache/queue changes, and corrupt-queue deletion. Android source disables backup and has a local native-config check; signed-manifest/restore proof and the device-level recovery/account-switch matrix remain open. |
| MOB-SYNC-001 | IN_PROGRESS | Phase 5 now refuses to advance the cursor or first-sync milestone for non-empty pages and publishes a schema-versioned typed event union with explicit `hasMore`/cursor semantics. Local transactional cache invalidation, collection trigger coverage, truthful bootstrap/full resync, retention maintenance, and disposable-PostgreSQL convergence evidence remain open. |
| MOB-QUEUE-001 | NOT_STARTED | Pending mutations require account ownership, conflict preservation, and dead-letter handling. |
| MOB-NET-001 | NOT_STARTED | Client requests lack unified deadlines, cancellation, response bounds, and foreground single-flight coordination. |
| MOB-CI-001 | IN_PROGRESS | Mobile commands now include a local native-config inspection, but it is not yet required by CI; dependency review and SBOM evidence also remain open. |
| MOB-UX-001 | IN_PROGRESS | The Android alpha exists; pagination, canonical routes, explicit environments, and bounded offline UX still require sixth-pass review. |
| MOB-PUSH-001 | IN_PROGRESS | There is no push provider. UI must not present mobile push as an active delivery channel. |
| MOB-PODCAST-001 | OWNER_ACTION_REQUIRED | Choose real native playback or remove podcast playback controls before internal testing. |
| OPS-TOPOLOGY-001 | NOT_STARTED | Monitoring must derive requirements from the reviewed topology manifest for every supported topology. |
| NET-001 | OWNER_ACTION_REQUIRED | A safe owner-run ingress proof package is required; no ingress modification is authorized. |
| PLAY-001 | OWNER_ACTION_REQUIRED | No signing identity, signed AAB, App Link certificate proof, or Play-track approval exists. |

States describe source and evidence independently. `SOURCE_COMPLETE` will not
be used as a deployment, signed-build, or Play-publication claim.

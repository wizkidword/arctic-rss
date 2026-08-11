# Sixth-pass capability status

**Baseline SHA:** `8e83e9ee818f8a715fb8c99a5ef81287b2bf0051`
**Scope:** source work in a clean isolated worktree. No website deployment or
Play action is represented by this ledger.

| ID | Status | Current evidence and next gate |
| --- | --- | --- |
| MOB-AUTH-001 | IN_PROGRESS | Phase 1 source verification: `MOBILE_NATIVE_AUTHORIZATION_ENABLED` is default-off; disabled authorization/exchange return `404` before body/session work. Existing GET issue, custom callback, registered-client binding, explicit consent, recent auth, and owner signing/App Link proof remain for Phase 2. |
| MOB-BODY-001 | SOURCE_VERIFIED | Phase 1 adds a shared 8 KiB/5 s JSON reader, media/encoding/UTF-8/JSON checks, IP-only pre-body limits, secret-specific post-body limits, generic errors, OpenAPI codes, and focused/full-suite evidence. No deployment is implied. |
| MOB-REFRESH-001 | IN_PROGRESS | Server refresh rotation is transactional, but native refresh single-flight and atomic persistence are not yet established. |
| MOB-DEVICE-001 | NOT_STARTED | `DeviceSession` is refresh-token history. An additive stable `MobileDevice` model and family-aware migration are required. |
| MOB-OFFLINE-001 | IN_PROGRESS | SQLite is present but has no proved authenticated-owner boundary or Android restore proof. |
| MOB-SYNC-001 | IN_PROGRESS | The existing bounded sync contract is a starting point; cursor advancement and invalidation need transactional non-lossy behavior. |
| MOB-QUEUE-001 | NOT_STARTED | Pending mutations require account ownership, conflict preservation, and dead-letter handling. |
| MOB-NET-001 | NOT_STARTED | Client requests lack unified deadlines, cancellation, response bounds, and foreground single-flight coordination. |
| MOB-CI-001 | IN_PROGRESS | Mobile commands exist and passed in this baseline, but required CI, native-config inspection, dependency review, and SBOM evidence do not yet exist. |
| MOB-UX-001 | IN_PROGRESS | The Android alpha exists; pagination, canonical routes, explicit environments, and bounded offline UX still require sixth-pass review. |
| MOB-PUSH-001 | IN_PROGRESS | There is no push provider. UI must not present mobile push as an active delivery channel. |
| MOB-PODCAST-001 | OWNER_ACTION_REQUIRED | Choose real native playback or remove podcast playback controls before internal testing. |
| OPS-TOPOLOGY-001 | NOT_STARTED | Monitoring must derive requirements from the reviewed topology manifest for every supported topology. |
| NET-001 | OWNER_ACTION_REQUIRED | A safe owner-run ingress proof package is required; no ingress modification is authorized. |
| PLAY-001 | OWNER_ACTION_REQUIRED | No signing identity, signed AAB, App Link certificate proof, or Play-track approval exists. |

States describe source and evidence independently. `SOURCE_COMPLETE` will not
be used as a deployment, signed-build, or Play-publication claim.

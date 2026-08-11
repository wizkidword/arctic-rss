# Google Play Data Safety source evidence

**Status:** source inventory for owner/legal review. This is not a completed Play
Console declaration, signed-artifact inspection, or legal advice.

This table is derived from the current mobile manifest, direct mobile runtime
dependencies, client/server data paths, and Prisma schema. Recreate the review
against the exact signed AAB and its SBOM before completing Play Data Safety.
Do not turn a source fact below into a legal conclusion without owner and
counsel review.

## Review scope and limits

- The managed Android source is apps/mobile/app.json; direct mobile runtime
  dependencies are in apps/mobile/package.json.
- Phase 8 CI creates a CycloneDX graph from the lockfile. It is source evidence
  only; a signed AAB needs a fresh artifact-level review.
- The app uses the first-party HTTPS Arctic RSS service. This record does not
  assert the practices of Expo build services, Android, Google Play, a browser,
  or any future provider.
- Recheck every “not currently collected” entry if a dependency, native
  permission, telemetry transport, playback/download feature, or push
  registration is added.

## Data inventory

| Data category | Exact field/source | Collected? | Transmitted? | Stored locally? | Stored server-side? | Purpose | Optional / required | Retention | Encryption in transit | Deletion behavior | SDK / provider | Policy section | Play Data Safety candidate answer | Owner / legal review |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Account identity and profile | Authenticated /api/v1/me responses and token-bundle userId; packages/mobile-client/src/api.ts and apps/mobile/src/auth/native-session-store.ts | Yes, after authorization | Yes, first-party API only | userId is in SecureStore; account-scoped response data can enter SQLite cache | Existing user/account records | Account access and reader data | Required after sign-in | Local bundle until logout/terminal failure; service retention needs review | Signed-build client requires HTTPS; inspect signed artifact | Local logout/terminal failure clear bundle and store; server deletion is separate | Expo SecureStore; first-party API | Privacy; retention/deletion | No automatic answer | Required |
| Authentication material | PKCE verifier/state/nonce, one-time authorization code, access/refresh token, expiry; apps/mobile/src/auth/browser-login.ts, apps/mobile/src/auth/native-session-store.ts, src/lib/mobile-auth.ts | Yes, only during auth/refresh | Authorization/code exchange to first-party service; callback returns code/state to app | Token bundle only in Android SecureStore; PKCE values transient | Code, token, and session records use one-way hashes where modeled | Device authentication and refresh | Required to sign in; approval is explicit | Source-configured expiry/lifetimes; published retention needs review | HTTPS in signed builds; signed artifact pending | Local logout/terminal failure clears local state; server revocation/deletion separate | Expo Crypto, Expo WebBrowser, Expo SecureStore; first-party API | Privacy, security, retention/deletion | No automatic answer | Required |
| Stable device and app metadata | mobileDeviceId, fixed device name, platform android, app version; apps/mobile/src/auth/browser-login.ts and Prisma MobileDevice | Yes, during authorization/refresh | Yes, first-party auth/token flows | mobileDeviceId in SecureStore and SQLite owner metadata | MobileDevice contains user relation, device/app fields, timestamps, revocation | Device ownership, revocation, management | Required for signed-in device | Source-defined active-device expiry/revocation; policy needs review | HTTPS in signed builds; signed artifact pending | Logout clears local owner state; service revocation/deletion needs policy confirmation | Expo Constants, SecureStore, SQLite; first-party API | Privacy; retention/deletion | No automatic answer | Required |
| Reader, feed, collection, saved-view, briefing, and podcast response data | Authorized API responses cached through apps/mobile/src/hooks/use-mobile-query.ts and use-mobile-pagination.ts | Yes, after authorized requests | Yes, first-party API | Bounded SQLite mobile_cache payloads | Authoritative account/reader records exist in service | Reader rendering and bounded offline display | Required only for requested feature | Per-entry 2 MiB limit and cache eviction; server retention needs review | HTTPS in signed builds; signed artifact pending | Logout, terminal failure, owner change, and full-resync cache reset purge/invalidate local cache | Expo SQLite; first-party API | Privacy; retention/deletion | No automatic answer | Required |
| Search terms | q sent by apps/mobile/app/(authenticated)/(tabs)/search.tsx; SQLite cache key contains search colon query through useMobilePagination | Yes, when submitted | Yes, first-party /api/v1/search | Yes, query appears in cache key and cached result payload | Search processing is service-side; logging/retention requires runtime review | Search authorized articles | Optional feature use | Local cache limit/eviction; service retention must be confirmed | HTTPS in signed builds; signed artifact pending | Logout, terminal failure, and cache invalidation clear SQLite cache | Expo SQLite; first-party API | Privacy; retention/deletion | No automatic answer | Required |
| Reader actions and offline mutations | Article state, collection add/remove, podcast state/progress, notification preference, idempotency key; apps/mobile/src/sync/submit-mobile-mutation.ts and packages/mobile-client/src/api.ts | Yes, when reader acts | Yes, first-party v1 mutation APIs; replay marker is fixed | Pending payload, timestamps, state, idempotency key in SQLite | Account state; receipts retain key/body hashes rather than raw body | Apply actions and safely retry network loss | Optional user actions | Local queue is bounded; server receipt cleanup is 30 days in src/lib/mobile-sync.ts | HTTPS in signed builds; signed artifact pending | Logout/terminal failure/owner change purge queue; user can retry/remove terminal entry | Expo SQLite; first-party API | Privacy; retention/deletion | No automatic answer | Required |
| Sync cursor, invalidation events, and product milestones | SQLite cursor and fixed milestones; apps/mobile/src/sync/synchronize-mobile-state.ts; server UserSyncEvent | Yes, for signed-in sync | Yes, first-party sync/bootstrap | Cursor/milestone in SQLite; events are not a second local event log | User sync journal and cursor floor | Cache invalidation and first/return session detection | Required for sync; milestones only after local commit | Server event source retention is 180 days in src/lib/mobile-sync.ts | HTTPS in signed builds; signed artifact pending | Local cursor/milestones purge with store; server deletion/retention needs confirmation | Expo SQLite; first-party API | Privacy; retention/deletion | No automatic answer | Required |
| Aggregate operational measurements | Fixed authorization, refresh, sync, journal, queue, and API-response records in src/lib/mobile-telemetry.ts and src/lib/api-v1/telemetry.ts | Yes, on applicable server path | No device-to-third-party analytics transport | No mobile telemetry database | First-party structured log destination is deployment-dependent | Reliability and operational monitoring | Server-path behavior | Source does not establish production log retention | No separate telemetry transport is introduced | Source records omit user/device/token/request/body/header/free-form name; live log retention needs review | First-party server logging; no mobile analytics SDK | Privacy; retention/deletion | No automatic answer | Required |
| Push registration token | No mobile registration call, permission request, provider SDK, or token registration; MOBILE_PUSH is unavailable | No in current source | No | No | Schema can represent a hashed installation token, but app does not provide one | Not applicable until reviewed provider exists | Not available | Not applicable | Not applicable | Not applicable | No mobile push provider SDK | Update before enabling push | Do not declare future feature | Recheck before implementation |
| Advertising, mobile analytics, and crash SDK data | Direct runtime manifest lists Expo/React modules only; no Sentry, Firebase, ad, analytics, or crash SDK in apps/mobile/package.json | Not identified in direct mobile source | Not identified | Not identified | Not identified | Not applicable | Not applicable | Not applicable | Not applicable | Not applicable | Direct inventory: Expo, React Native, first-party packages; do not infer provider practices | Update before adding SDK | Do not answer “no” without exact AAB/SDK review | Required before submission |

## Required privacy-policy reconciliation

The rendered privacy page reads the Privacy Policy section from
docs/arcticirc/arcticirc-launch-policy-package.md through
src/lib/approved-policy.ts. Do not edit approved legal text based only on this
engineering inventory. Owner/legal review must decide accurate wording for:

- Browser-mediated native-device authorization and short-lived proofs.
- Stable device records, rotating refresh history, device/app metadata, and
  revocation.
- SecureStore token bundle, account-scoped SQLite cache, search cache keys,
  pending mutations, cursor, and local milestones.
- First-party sync-event journal, 30-day receipt cleanup, and 180-day
  source retention setting.
- Backup-disabled configuration and exact signed-artifact result.
- Aggregate operational records plus live log destination and retention.
- The absence of current push delivery and the review required before adding it.
- Device-side/server-side deletion behavior and documented exceptions.

The final declaration needs approval against the exact AAB, live policy URLs,
deployment log configuration, and relevant provider terms. This source record
intentionally makes no submission-ready legal claim.

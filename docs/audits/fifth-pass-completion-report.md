# Fifth-pass completion report

**Reviewed:** 2026-08-10

**Baseline:** `686cd18b7e7f6196865af34c93496c3bddf16a69`

**Source head before this completion commit:** `bb5c28f`

**Current completion candidate:** this local commit; not deployed

## Honest conclusion

**SOURCE COMPLETE — NOT DEPLOYED**

**WEBSITE RELEASE READY — OWNER APPROVAL REQUIRED**

**ANDROID INTERNAL BUILD READY — PLAY OWNER APPROVAL REQUIRED**

The first statement means the reviewed source and local verification are
committed locally. It does not mean the candidate is pushed, deployed, or live.
The second and third statements are separate: a fresh exact-commit website
release and an exact-artifact Play decision remain owner actions.

## What this pass now contains

- Reliability and data-integrity work: account eligibility fencing; OPML and
  Smart Digest leases; source-refresh generation fencing; publisher-text and
  publication-date boundaries; resumable external-ID hashing; reader cluster
  current-version qualification; lightweight navigation projections; reverse
  subscription indexes; and least-privilege Redis/chat boundaries.
- First-party mobile platform work: explicit v1 contracts/OpenAPI; browser PKCE
  device sessions; bounded sync/tombstones/full resync; session-bound
  idempotent writes; notification preferences; deep-link fallback; and a local
  Expo/React Native Android alpha.
- Phase 14 coherence work: retained collection provenance and removal on web
  and mobile, truthful bounded offline indicators, consent-gated web
  first-success milestone events, and fixed Android first-sync/return telemetry
  without user/device/content values.

The primary commit sequence is `c7be850` (fifth-pass web release), `98e47b0`
(mobile API), `048f1a7` (device auth), `482d141` (sync), `55b6f0b` (Android
alpha), `ec56986`/`bb5c28f` (private CI/release-gate remediation), then the
committed Phase 14 candidate. The authoritative detailed finding ledger is
[fifth-pass capability status](./fifth-pass-capability-status.md).

## Database, compatibility, and security record

- The fifth-pass migration ledger recognizes 11 reviewed migrations, including
  device authentication and mobile sync foundations; a disposable PostgreSQL
  rehearsal reports 53 total applied migrations. Migration-risk findings are
  documented risk flags with hash-bound records, not permission to run a
  migration against production.
- API v1 remains first-party and additive. Existing web behavior and API
  response envelopes are preserved; the collection-retention field is optional.
  No public API compatibility commitment has been created.
- Redis and Compose boundaries, restricted chat role behavior, connection
  budgets, and topology validation have passing local evidence. No Phase 14
  secret, token, feed/article body, or user/device identifier is added to
  product telemetry.
- The last independently verified production revision was `bb5c28f` on
  2026-08-10. This closeout did not inspect production or change OVH, so it
  makes no claim about live state after that verification.

## Phase 15 verification

All commands below used Node 24.18.0 unless noted.

| Check | Result |
| --- | --- |
| Prisma generate, format check, and validate | Passed |
| Migration risk, fifth-pass migration ledger, capability ledger | Passed; risk output retained expected reviewed warnings |
| Generated OpenAPI contract | Regenerated after Phase 14 optional-field change; drift check passed |
| Full unit/regression suite | Passed: 310 files, 1,515 tests; 11 files / 21 tests intentionally skipped |
| Typecheck and mobile typecheck | Passed |
| Web lint | Passed |
| Mobile lint | Passed with no warnings |
| Production web build | Passed |
| Topology, Compose environment/dependency/Redis boundaries, connection budgets, OPML admission, Redis integration, and restricted chat role | Passed |
| Chat release gates | Passed: 18 files, 114 tests |
| Public browser smoke/CSP/liveness | Passed on an isolated local port: 3 passed; 7 authenticated-fixture tests intentionally skipped because that fixture mode was not enabled |
| Expo Doctor | Passed: 20/20 checks after upgrading Expo and Expo Router to 57.0.12 |
| Android JavaScript export | Passed; unsigned bundle only, not an APK/AAB or Play artifact |

The first default browser attempt reused an unrelated local server on port 3000
and failed as expected against that wrong origin. The recorded passing run used
a fresh port with explicit loopback allowed-host configuration.

## Android and Play record

`apps/mobile` currently declares `com.arcticrss.reader`, version `0.1.0`, and
versionCode `1`. Expo SDK 57.0.12 supplies target SDK 36; the generated signed
artifact must still be checked before upload. No Android SDK, signing key, EAS
project, AAB, Play Console project, tester group, store listing, Data safety
form, or submission was created here. See
[Google Play readiness](../mobile/google-play-readiness.md) for the exact
remaining owner checklist.

## Remaining owner actions

1. Review this committed candidate and obtain exact-commit CI.
2. If a website release is desired, complete the current OVH preflight and
   provide `DEPLOY <short-sha>` for that committed candidate. The release
   package must capture exact images, migrations, backup/restore evidence,
   topology/environment/ACL evidence, rollback or forward repair, and
   post-release public health/login smoke.
3. If an Android internal alpha is desired, confirm application-ID ownership,
   signing/EAS setup, the production API origin, App Links, the signed-device
   smoke record, Play Console policy forms/listing, and provide a separate
   exact-artifact/internal-track approval. Do not use a website deployment
   approval for that action.
4. Triage the current dependency audit separately from this source closeout;
   `npm audit --omit=dev --audit-level=high` currently reports 19 advisories
   (10 high, 9 moderate), chiefly through Expo/Metro build tooling plus
   transitive Hono/UUID paths. Automatic fixes were not applied because the
   offered remedies include breaking Expo/React Native changes. Record a
   reviewed dependency decision before the signed Android build or a future
   release.

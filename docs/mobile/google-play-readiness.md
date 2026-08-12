# Google Play readiness

**Status:** Android source and a pre-identity signed internal AAB candidate are
ready for owner handoff. No Play Console project, tester group, store listing,
Data safety declaration, upload, or submission has been created.

The canonical [release-candidate manifest](./release-candidate.json) records
the exact completed preview AAB. Its status is **SUPERSEDED** because later
mobile-auth and server changes require a replacement reviewed build. The
manifest, generated status, and staged App Links statement are checked together
by `npm run mobile:verify-release-candidate`.

This is an owner checklist, not authorization to upload or submit anything.
Recheck the linked official requirements in Play Console immediately before an
upload because requirements can change.

The source-backed [Data Safety evidence](./google-play-data-safety-evidence.md)
and [signed-device smoke plan](./android-signed-device-smoke-plan.md) now
prepare the two Phase 11 handoff inputs. They remain owner/legal review items,
not completed declarations or test results.

## Current source facts

| Item | Current evidence | Owner action before internal upload |
| --- | --- | --- |
| Android application ID | `com.arcticrss.reader` in `apps/mobile/app.json`; provisional until ownership is confirmed | Confirm the package is unclaimed or owned by the approved developer account before the first Play upload. |
| Versioning | App version `0.1.0`; `versionCode` `1`; EAS remote version source is explicit in `apps/mobile/eas.json` | Confirm the first Play version and preserve a monotonically increasing managed version code for every later artifact. |
| Target SDK | Expo SDK `57.0.12` defaults to compile and target SDK 36. This meets Google Play's stated Android 16/API 36 requirement for new apps and updates from 2026-08-31. | Inspect the generated signed AAB/manifest and record the observed target SDK; do not rely only on this source record. |
| Build profile | `preview` produces an internal-distribution Android app bundle; a candidate completed from `18767e5` | Rebuild after the explicit remote-version configuration is merged, then use the resulting candidate for the smoke test. |
| App Links | HTTPS filters are declared and a matching `public/.well-known/assetlinks.json` is staged in source | A separately approved website release must make the JSON public; test every declared route on a signed device. |
| Private API/auth | Browser PKCE, rotating device sessions, secure token storage, bounded SQLite cache, and idempotent offline mutation replay are implemented | Run the signed-device smoke test and record only non-secret results. |

Google Play's current target-SDK requirement is documented at
<https://developer.android.com/google/play/requirements/target-sdk>. Expo's SDK
57 platform table documents target SDK 36 at
<https://docs.expo.dev/versions/latest/>.

## Pre-identity candidate evidence

| Item | Verified value |
| --- | --- |
| EAS build | `8a8f6fd9-770a-462f-9089-2ba57b3d7121` — `preview`, Android, internal distribution, finished 2026-08-11 local time |
| Source revision | `bf6564902bf3e406615ba4e2339a02a6535a0f61` |
| Application and version | `com.arcticrss.reader`; `0.1.0` / build version `1` |
| Archive SHA-256 | `DFBDEC75004B25B5077D5DCE1F71222257961DD1E9F6C6A98B183CA02450DE8D` |
| Manifest inspection | Package and `targetSdkVersion` are `com.arcticrss.reader` and `36` in the finished AAB. |
| Archive signature | The AAB's JAR signature block validated. The exact certificate pin is retained in the staged App Links association and the external release record. |
| What this does not prove | Play package ownership, Play identity verification, track/tester access, live App Links, browser sign-in return, or signed-device behavior. |

## Required owner checklist

1. Confirm the Play Console developer account type, verified identity/profile,
   and authorized release owners. Google Play requires current account and
   developer information; do not put any identity material in this repository.
2. Confirm ownership of `com.arcticrss.reader`, create/select the signing key,
   and retain its SHA-256 certificate fingerprint outside the repository.
3. Rerun the [reviewed dependency-audit checks](../audits/fifth-pass-dependency-audit-decision.md)
   against the exact source revision. Do not run a blanket `npm audit fix`; a
   dependency change requires its own Expo-compatible review.
4. Configure the reviewed EAS project and build environment with the approved
   HTTPS API origin. Build a `preview` AAB; record build ID, exact source SHA,
   version/versionCode, artifact checksum, target SDK, and signing fingerprint.
5. Serve `https://arcticrss.com/.well-known/assetlinks.json` for that exact
   package/fingerprint. Verify Android App Links, browser PKCE return,
   reader/search/article state, collection add/remove, offline retry, podcast
   episode notes and completion/star state, notification preference, logout
   purge, and every link route on a
   signed test device.
6. Create the internal testing track and add only the approved tester group.
   Upload the reviewed AAB only after the separate owner approval described
   below. Check Play Console's current policy notices, crash/ANR dashboard,
   and release notes before rollout.
7. Complete the store listing: app name, short/full descriptions, application
   category, contact/support details, privacy-policy URL, screenshots, app
   icon/feature graphics as required, content rating questionnaire, and any
   app-access instructions for the reviewer. Verify all public URLs from a
   signed-out browser.
8. Complete the Data safety and Data deletion declarations from the current
   [code-and-SDK inventory](./google-play-data-safety-evidence.md). The form
   covers data transmitted by the app and its SDKs, not merely data stored
   locally. A legal and owner review must validate the final answers, purposes,
   retention, live log destination, and all bundled SDK disclosures.
9. Execute the approved [signed-device smoke plan](./android-signed-device-smoke-plan.md)
   against the exact AAB and record only redacted results.
10. Ensure the store listing and in-app settings link to the live privacy policy
   at `https://arcticrss.com/privacy`, and that account deletion is available
   from the app/web handoff at `https://arcticrss.com/delete-account`. Recheck
   the hosted flows after the candidate website revision is live.

Google's current Data safety guidance is
<https://support.google.com/googleplay/android-developer/answer/10787469> and
the account-deletion requirements are
<https://support.google.com/googleplay/android-developer/answer/13327111>.
Both require owner-accurate declarations; this document intentionally does not
guess final Play Console answers.

## Release boundary

A signed build or upload is not authorized by source completion. Before an
internal Play upload, the owner must provide a fresh approval that explicitly
identifies the exact AAB/source revision and internal track. A website change
still requires the separate `DEPLOY <short-sha>` approval after exact-commit
CI and the approved OVH readiness gate.

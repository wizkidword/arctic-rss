# Google Play readiness

**Status:** Android source and unsigned JavaScript export are ready for an
internal-build handoff. No signing identity, EAS build, AAB, Play Console
project, tester group, store listing, Data safety declaration, or submission
has been created.

This is an owner checklist, not authorization to upload or submit anything.
Recheck the linked official requirements in Play Console immediately before an
upload because requirements can change.

## Current source facts

| Item | Current evidence | Owner action before internal upload |
| --- | --- | --- |
| Android application ID | `com.arcticrss.reader` in `apps/mobile/app.json`; provisional until ownership is confirmed | Confirm the package is unclaimed or owned by the approved developer account before the first signed build. |
| Versioning | App version `0.1.0`; `versionCode` `1` | Choose the first release version and preserve a monotonically increasing version code for every later artifact. |
| Target SDK | Expo SDK `57.0.12` defaults to compile and target SDK 36. This meets Google Play's stated Android 16/API 36 requirement for new apps and updates from 2026-08-31. | Inspect the generated signed AAB/manifest and record the observed target SDK; do not rely only on this source record. |
| Build profile | `preview` produces an internal-distribution Android app bundle | Create/review EAS project and credentials, then run the profile in the approved build account. |
| App Links | HTTPS filters are declared for Arctic RSS reader paths | Publish and verify `assetlinks.json` only after a signing certificate fingerprint exists; test every declared route on a signed device. |
| Private API/auth | Browser PKCE, rotating device sessions, secure token storage, bounded SQLite cache, and idempotent offline mutation replay are implemented | Run the signed-device smoke test and record only non-secret results. |

Google Play's current target-SDK requirement is documented at
<https://developer.android.com/google/play/requirements/target-sdk>. Expo's SDK
57 platform table documents target SDK 36 at
<https://docs.expo.dev/versions/latest/>.

## Required owner checklist

1. Confirm the Play Console developer account type, verified identity/profile,
   and authorized release owners. Google Play requires current account and
   developer information; do not put any identity material in this repository.
2. Confirm ownership of `com.arcticrss.reader`, create/select the signing key,
   and retain its SHA-256 certificate fingerprint outside the repository.
3. Configure the reviewed EAS project and build environment with the approved
   HTTPS API origin. Build a `preview` AAB; record build ID, exact source SHA,
   version/versionCode, artifact checksum, target SDK, and signing fingerprint.
4. Serve `https://arcticrss.com/.well-known/assetlinks.json` for that exact
   package/fingerprint. Verify Android App Links, browser PKCE return,
   reader/search/article state, collection add/remove, offline retry, podcast
   progress, notification preference, logout purge, and every link route on a
   signed test device.
5. Create the internal testing track and add only the approved tester group.
   Upload the reviewed AAB only after the separate owner approval described
   below. Check Play Console's current policy notices, crash/ANR dashboard,
   and release notes before rollout.
6. Complete the store listing: app name, short/full descriptions, application
   category, contact/support details, privacy-policy URL, screenshots, app
   icon/feature graphics as required, content rating questionnaire, and any
   app-access instructions for the reviewer. Verify all public URLs from a
   signed-out browser.
7. Complete the Data safety and Data deletion declarations from a current
   code-and-SDK inventory. The form covers data transmitted by the app and its
   SDKs, not merely data stored locally. The current source sends account and
   reader-state requests to the Arctic RSS first-party service, stores tokens
   in secure storage, and retains bounded reader/cache/mutation data locally;
   it has no configured advertising, analytics, or push-provider SDK. A legal
   and owner review must validate the final answers, purposes, retention, and
   all bundled SDK disclosures.
8. Ensure the store listing and in-app settings link to the live privacy policy
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

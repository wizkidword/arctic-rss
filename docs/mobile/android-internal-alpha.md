# Android internal alpha handoff

## Source record

- App workspace: `apps/mobile`
- Package name: `com.arcticrss.reader` (provisional; confirm ownership before signing)
- Version: `0.1.0` source configuration, Android `versionCode` 1
- Build profiles: `development` (internal APK/dev client) and `preview` (internal AAB)
- Public Play release: not configured and not authorized

The native alpha uses the private first-party v1 API and the browser PKCE device
authorization flow. It stores tokens only in Android Keystore-backed secure
storage, keeps bounded reader/podcast metadata and pending idempotent mutations
in local SQLite, and removes both on local logout. It does not log access
tokens, refresh tokens, API request bodies, or cached reader content.

The stored sync cursor is advanced only after a validated private sync response.
If the server requires a full resync, the app clears downloaded cache and the
cursor, then restarts that read-only sync; it never drops pending mutations for
that condition. A terminal 401 session failure clears secure tokens, cache,
pending mutations, and the cursor so account disablement/deletion cannot leave
mobile data accessible through this app.

## Included in this alpha

- Browser sign-in; All, Unread, and Starred reader views; article actions and collection save/remove
- Search, saved views, collections, Smart Digest briefing detail, and podcast episode progress/state
- Notification preference changes, device-management web link, privacy, support entry, and account deletion link
- HTTPS App Link routes for articles, podcast episodes, collections, saved views, and briefings

OPML import/export, advanced source hygiene, administrative operations, external
chat, story merge/split, AI model selection, and account-export generation
remain web-only by design.

## Verified locally

Run from the repository root with Node 24:

```powershell
npm run mobile:doctor
npm run mobile:typecheck
npm run mobile:lint
npm run mobile:export:android
```

The source configuration and Android JavaScript bundle pass these checks. The
bundle export is not a signed Android artifact and does not establish a Play
track or tester access.

## Required before a signed internal build

1. Confirm that `com.arcticrss.reader` is the intended unclaimed/owned Android package name, or change it before the first build.
2. Create or select the Android signing identity in the approved build account; record its SHA-256 certificate fingerprint outside the repository.
3. Serve `https://arcticrss.com/.well-known/assetlinks.json` containing that exact package name and signing fingerprint, then verify Android App Links on a signed device. Do not publish this file before the signing identity exists.
4. Set the approved HTTPS `EXPO_PUBLIC_ARCTIC_RSS_ORIGIN` for the build environment. No HTTP origin is allowed outside an explicit development build.
5. Create a reviewed EAS project/credential configuration and run the `preview` profile from `apps/mobile` to produce an internal AAB. Record the build ID, version code, signing certificate fingerprint, and tester group.
6. Exercise the signed-device smoke test: browser login, reader/search/article state, collection add/remove, offline queue then foreground retry, podcast progress, notification setting, logout purge, and every App Link.

This workstation does not currently have Android SDK tooling configured, and no
EAS build, signing identity, Play Console project, tester group, or submission
has been created by this phase.

See [Google Play readiness](./google-play-readiness.md) for the separate
submission checklist, current target-SDK evidence, and the owner-only actions.

## Workspace note

The repository's web application already pins React 19.2.4. The mobile package
uses that single hoisted copy and explicitly excludes React from Expo's version
check; Expo Doctor confirms there are no duplicate native dependencies. Recheck
this exception when upgrading Expo SDK or React.

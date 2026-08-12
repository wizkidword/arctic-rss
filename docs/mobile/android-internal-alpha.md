# Android internal alpha handoff

## Source record

- App workspace: `apps/mobile`
- Package name: `com.arcticrss.reader` (provisional; confirm ownership before the first Play upload)
- Version: `0.1.0`, Android `versionCode` 1; EAS version control is explicitly remote for future builds
- Build profiles: `development` (internal APK/dev client) and `preview` (internal AAB)
- Signed preview candidate: EAS build `8a8f6fd9-770a-462f-9089-2ba57b3d7121`, built from `bf6564902bf3e406615ba4e2339a02a6535a0f61`; no Play upload, track, tester group, or release exists
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
- Search, saved views, collections, Smart Digest briefing detail, and podcast episode notes/completion/star state
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

## Remaining before internal Play distribution

1. Confirm that `com.arcticrss.reader` is the intended unclaimed/owned Android package name, or change it before the first Play upload.
2. Confirm the long-term owner and retention of the signing identity used for the candidate; retain the release certificate record outside the repository.
3. Deploy the staged `public/.well-known/assetlinks.json` only through a separately approved website release, then verify every declared App Link on a signed device. The live endpoint currently remains absent.
4. Keep the approved HTTPS `EXPO_PUBLIC_ARCTIC_RSS_ORIGIN` for the build environment. No HTTP origin is allowed outside an explicit development build.
5. Create a replacement candidate after the explicit remote-version configuration is merged, then use that exact candidate for the signed-device smoke test. Create another candidate with a higher managed version code if its mobile source or signing choice changes.
6. Exercise the signed-device smoke test: browser login, reader/search/article state, collection add/remove, offline queue then foreground retry, podcast episode notes/completion/star state, notification setting, logout purge, and every App Link. Native playback and listening-progress controls are deferred.

This workstation does not currently have Android SDK tooling configured. The
remote EAS candidate is signed and its archive provenance was checked, but no
Play Console project, tester group, upload, or submission has been created.

See [Google Play readiness](./google-play-readiness.md) for the separate
submission checklist, current target-SDK evidence, and the owner-only actions.

## Workspace note

The repository's web application already pins React 19.2.4. The mobile package
uses that single hoisted copy and explicitly excludes React from Expo's version
check; Expo Doctor confirms there are no duplicate native dependencies. Recheck
this exception when upgrading Expo SDK or React.

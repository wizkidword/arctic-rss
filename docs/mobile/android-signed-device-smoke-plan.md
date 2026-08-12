# Android signed-device smoke plan

**Status:** owner-run test plan. No signed artifact, device test, Play track, or
upload is represented by this document.

Run this plan only after the owner selects a signing identity, produces a
specific preview AAB, records its checksum and certificate fingerprint outside
Git, and publishes matching assetlinks.json. Record source SHA, AAB SHA-256,
version/versionCode, device/Android version, network condition, and pass/fail.
Never record a token, authorization code, query text, article body, email
address, device identifier, or screenshot exposing private reader data.

## Preconditions

- Install the approved signed preview AAB on a physical Android device.
- Inspect the generated manifest: application ID, versionCode, target SDK,
  exported components, approved permissions, backup-disabled settings, and no
  cleartext production traffic.
- Confirm https://arcticrss.com/.well-known/assetlinks.json contains the exact
  package name and signing SHA-256 fingerprint for this artifact.
- Use disposable test accounts/content where a scenario changes account state.
  A separate owner must operate any disablement or deletion control.
- Establish a recovery path before clearing storage, revoking a device,
  disabling an account, or changing network state.

## Test matrix

| Scenario | Device / account setup | Procedure | Source-defined pass condition | Record |
| --- | --- | --- | --- | --- |
| Fresh install and explicit approval | Fresh signed install; browser already signed into a disposable account | Start mobile sign-in | Browser flow still requires explicit approve before device code issue | Pass/fail and non-secret timestamp |
| Cancel authorization | Fresh signed install | Start sign-in and cancel in browser | App remains signed out; no protected screen mounts | Pass/fail |
| Auth callback App Link | Fresh signed install with verified asset links | Complete approved sign-in | HTTPS callback returns to app and creates usable session | App-Link result; no code/state |
| Content App Links | Signed install with verified asset links | Open every declared article, podcast episode, collection, saved-view, and briefing link | Each claimed route opens intended app destination or normal unavailable state | Route-by-route pass/fail |
| Concurrent refresh | Signed-in device; simultaneous API reads near access-token expiry in disposable environment | Trigger multiple screens/requests | One coordinated refresh succeeds or truthful retryable/auth-required state appears; no token shown | Pass/fail and error class only |
| Offline launch | Signed-in device with known cache; disable network | Relaunch and navigate cached screens | Safe offline/cache state; no other account data is visible | Pass/fail |
| Account A to Account B switch | Sign in as disposable A, sign out, sign in as B | Inspect reader, queue, cached views | Owner boundary purges A cache/cursor/queue before B access | Pass/fail |
| Device revocation | Two devices on disposable account; owner revokes test device | Foreground/restart revoked device | Terminal session failure removes local session/cache/queue and requires sign-in | Pass/fail |
| Account disablement | Disposable account; owner-controlled disablement | Foreground/restart device | Device loses authorization and local state is purged | Pass/fail |
| Reader actions | Signed-in device with disposable article | Read, star, archive, refresh/relaunch | Authoritative state appears after sync and retries are truthful | Pass/fail per action |
| Collection add/remove | Disposable article and collection | Add and remove article | Mutation result and subsequent reader state converge | Pass/fail |
| Pagination | Reader and search results exceed one page | Load next page repeatedly | Cursor advances, duplicate items are avoided, bounded display is truthful | Pass/fail and page count only |
| Full resync | Disposable environment with cursor outside retained history | Trigger synchronization | Private bootstrap resumes sync; pending mutations remain intact | Pass/fail; no cursor value |
| Offline queue and conflict | Interrupt network during mutation; later reconnect; separately arrange missing resource or key reuse | Observe replay and Offline Changes | Retryable work replays; missing/reused mutation becomes visible owner-only conflict | Pass/fail and conflict class only |
| Backup / restore | Signed device with safe backup/restore test path | Back up, uninstall/reset, restore, open app | Restored app does not recover authenticated local state contrary to backup-disabled boundary | Pass/fail and Android version |
| Privacy and deletion links | Signed-in and signed-out browser contexts | Open in-app privacy, support, deletion links; complete only safe review | Links reach public HTTPS endpoints; no non-disposable account deletion | URL availability and pass/fail |
| Podcast boundary | Signed device | Visit podcast detail, review notes, and use only completion/star controls | No audio player or listening-progress control is presented; no in-app playback claim | Pass/fail |
| Notification / push boundary | Signed device | Visit notification settings | No push permission/token registration; unavailable push is labeled truthfully | Pass/fail |
| Process death during refresh | Signed-in disposable account near refresh | Force-stop during request, relaunch | Token bundle is atomically valid or cleared; no unowned cache visible | Pass/fail |
| Network loss during mutation | Signed-in disposable account | Interrupt mutation, relaunch, reconnect | Mutation completes, safely replays, or shows retry/conflict; no silent duplicate | Pass/fail and result class |
| Upgrade from alpha SQLite schema | Prior supported database/build or controlled fixture | Install approved update over prior build | Valid owned data upgrades or unsupported/corrupt local state safely resets | Version pair and pass/fail |

## Completion boundary

Attach only redacted results to the release record and let the owner decide
whether a failure blocks the internal track. Passing this plan does not
authorize upload: an internal-track upload needs fresh approval naming the
exact AAB, source revision, checksum, and target track.

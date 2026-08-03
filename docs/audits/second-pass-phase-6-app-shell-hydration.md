# Phase 6B — Authenticated-shell hydration boundary

## Status

Implemented and production-built locally. This is not a deployed change.

## Change

`AppShell` is now a Server Component. Its structural navigation, account
layout, and server-rendered reader navigation no longer inherit a broad client
boundary. Browser behavior remains in narrowly scoped client islands:

- `AppShellThemeController` applies and observes the selected theme.
- `AppShellHelpMenu` owns its menu and feedback-dialog state.
- `AppShellAccountMenu` owns its account dropdown and sign-out action.
- Existing interactive feed-context, add-feed, sheet, verification-reminder,
  and bulk-read components remain client components.

The server shell passes `AddFeedSheet` only folder ids and names, and passes
`FeedNavContextMenu` only its six required subscription fields. This avoids
serializing unrelated folder and feed metadata across those client boundaries.

## Build evidence

The pre-split production manifest exposed `src/components/app-shell.tsx` as a
client module. The post-split manifest exposes only the three client islands
listed above.

Summing each manifest entry's unique emitted JavaScript assets gives:

| Entry | Before | After | Change |
| --- | ---: | ---: | ---: |
| Authenticated layout | 369,612 bytes | 356,191 bytes | -13,421 bytes (-3.6%) |
| `/app` page | 415,004 bytes | 402,640 bytes | -12,364 bytes (-3.0%) |

These are raw build-output byte counts. Actual transfer size varies with
compression, cache state, and the route visited, so they are a reliable
boundary-regression check rather than a claim about a user's exact network
transfer.

## Verification

- `npm run typecheck`
- Focused Vitest coverage for the shell, authenticated layout, and feed context
  menu: 3 files and 10 tests passed
- `npm run build` with Next.js 16.2.11 and Turbopack

## Remaining Phase 6 work

- Capture representative database, render, and memory measurements for the
  reader list/detail projection work.
- Exercise the full change in an approved release environment before treating
  Phase 6 as production-verified.

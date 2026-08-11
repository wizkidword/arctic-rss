# Sixth-pass baseline

**Captured:** 2026-08-11
**Status:** IN_PROGRESS
**Production interaction:** none
**Play interaction:** none

## Repository boundary

- **Starting SHA:** `8e83e9ee818f8a715fb8c99a5ef81287b2bf0051`
  (`chore(mobile): link Expo EAS project`).
- **Audit reference:** `7e5f7fe1a27256b8997235597de92427fbec614f`.
  The starting SHA contains the audit reference as an ancestor; it is not an
  instruction to reset to that reference.
- **Worktree:** clean isolated worktree on `codex/fifth-pass-phase-10`.
  The older primary checkout is intentionally untouched because it is behind
  this branch and contains unrelated guest-OPML work.
- `git diff --check` passed at capture time.

No production host, database, Cloudflare, DNS, tunnel, signing identity, EAS
credential, Play Console, tester group, or Android artifact was changed.

## Runtime and source inventory

| Item | Observed value |
| --- | --- |
| Node.js used for this baseline | `v24.14.0` |
| npm used for this baseline | `10.8.2` |
| Committed Prisma migrations | `53` |
| Workspaces | `apps/mobile`, `packages/api-contract`, `packages/mobile-client` |
| Mobile package | `@arctic-rss/mobile` |
| Android application ID | `com.arcticrss.reader` (provisional until owner confirms ownership) |
| Mobile version / versionCode | `0.1.0` / `1` |
| Current callback source configuration | `arcticrss://auth/callback` custom scheme |
| Current deployed status | Not revalidated in this pass. The fifth-pass record names `7e5f7fe` as its last independently verified website release; this document makes no current-live claim. |
| Android distribution status | No signed artifact, EAS build, Play upload, or track exists as evidence in this pass. |

## Fresh local verification recorded so far

| Command or equivalent direct invocation | Result |
| --- | --- |
| `npm run prisma:generate` | Passed |
| `npx prisma format --check` | Passed |
| `npx prisma validate` | Passed |
| `npm run api:openapi:check` | Passed |
| `npm run mobile:doctor` | Passed: 20/20 checks |
| `npm run mobile:typecheck` | Passed |
| `npm run mobile:lint` | Passed |
| `npm run mobile:export:android` | Passed; unsigned JavaScript bundle only |
| `npm test` | Passed: 312 files / 1,532 tests; 11 files / 21 tests skipped |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npm run build` | Passed; Next.js generated 29 static pages |
| `npm audit --omit=dev --json` | Completed with exit `1`: 19 advisories (10 high, 9 moderate, 0 critical). No dependency or lockfile was changed. |
| Topology, Compose, Redis, legacy-Redis, and database-budget checks | Passed for all four supported topologies |
| Chat release gates | Passed: 18 files / 114 tests |

`npm ci --legacy-peer-deps` was started with Node 24 but the local command
runner terminated it at its execution deadline before it returned a result.
It is therefore **not** represented as passing clean-install evidence. The
The OPML admission command reached its disposable PostgreSQL migration setup
but stopped with `Command failed while applying migrations to the disposable
PostgreSQL fixture.` This is recorded as an environment/rehearsal failure, not
a product pass. The clean-install result, disposable database rehearsal, and
browser authorization coverage remain pending for Phase 0 closeout. The
dependency result matches the existing Expo-compatible exception decision; no
automatic audit remediation was attempted. Existing fifth-pass counts and
audit findings are historical evidence only and have not been copied here as
current results.

## Baseline findings

1. `GET /api/mobile/authorize` issues a code immediately for a fresh browser
   session, and the source has no native-authorization containment flag.
2. Authorization and exchange are bound only to a fixed custom scheme; there
   is no registered-client identifier or claimed HTTPS authorization callback.
3. Token exchange and refresh call `request.json()` before their rate limit,
   so their public request bodies have no shared byte bound, read deadline, or
   pre-body IP-only limit.
4. The Android client falls back to the production service origin and its
   secure-storage writes are multi-step; neither behavior is ready for a
   signed build.
5. Existing `DeviceSession` rows represent refresh-token history rather than
   a stable device record. Local SQLite and sync behavior need the ownership
   and transactional reviews defined by this pass.

## Phase 0 exit status

The required ADRs and sixth-pass ledger are created alongside this baseline.
Phase 0 remains **IN_PROGRESS** until the pending current verification is
recorded. Phase 1 containment and bounded token-request work is source-verified
separately in the capability ledger; it does not deploy or enable native
authorization.

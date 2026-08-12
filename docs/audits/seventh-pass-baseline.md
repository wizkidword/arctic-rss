# Seventh-pass baseline

**Captured:** 2026-08-12  
**Scope:** isolated source worktree only; no production, EAS, Google Play, tunnel, backup, or database action was performed.

## Repository boundary

| Item | Observed value |
| --- | --- |
| Starting revision | `6672dad21274c25a2d90f0db9aaf007f053515a6` |
| Seventh-pass audit revision | `6672dad21274c25a2d90f0db9aaf007f053515a6` |
| Recorded production revision at audit time | `7e5f7fe1a27256b8997235597de92427fbec614f` |
| Branch | `codex/seventh-pass-hardening` |
| Worktree | `C:\\Users\\jrock\\Documents\\Codex\\2026-08-12\\ple\\work\\arctic-rss-seventh-pass` |
| Working tree before seventh-pass edits | clean |
| Source remote | `origin` (`wizkidword/arctic-rss`) |

The older primary checkout remains untouched because it contains unrelated
guest-OPML work. This worktree was created directly from the current
`origin/main`, which is the recorded seventh-pass audit revision. The audit
revision contains the recorded production revision as an ancestor; it does not
make a claim about current production state.

## Local tool inventory

| Item | Observed value |
| --- | --- |
| Default shell Node.js | `v20.19.0` (below the mobile dependency minimum patch) |
| Gate runtime | `v24.18.0` |
| Gate npm | `11.16.0` |
| Docker | `29.6.2` |
| Docker Compose | `v5.3.1` |
| Prisma / Expo | evaluated after the clean install as part of the phase gates |

`npm ci --legacy-peer-deps` was run with the validated Node 24 runtime. The
task runner timed out while waiting for its final output, so that command is
not recorded as a clean-install pass. Its resulting dependency tree was then
checked with `npm ls --depth=0 --omit=optional` and had no unmet dependency
errors. Subsequent gates use the same Node 24 runtime.

## Finding inventory

| Finding | Status at baseline | Code and test surface |
| --- | --- | --- |
| P0 native authorization containment | **Partially fixed** | `src/lib/mobile-auth-configuration.ts`, authorize/exchange/refresh routes and their tests. Authorize and exchange are gated, but refresh is not gated before reading its body. |
| P1 stable-device ownership | **Confirmed open** | Prisma mobile-device models/migrations, `src/lib/mobile-auth.ts`, `src/lib/mobile-sync.ts`, and mobile-auth integration tests. Receipts and installations still require `deviceSessionId` with cascade deletion. |
| P1 local logout and account switching | **Confirmed open** | `apps/mobile/src/auth/native-session-store.ts`, `apps/mobile/src/providers/mobile-app-provider.tsx`, and offline-store tests. Cleanup is awaited before state reset and hydration can launch purge without awaiting it after an error. |
| P1 browser authorization hardening | **Confirmed open** | `src/app/api/mobile/authorize/route.ts`, `src/lib/mobile-auth.ts`, and route tests. Approval POST calls `request.formData()` without a small bounded reader, does not validate browser origin, and has no current-session recent-auth proof. |
| P2 lifecycle retention | **Partially fixed** | Mobile sync-event retention is maintenance-owned; mobile authorization, session, receipt, and installation lifecycle retention needs a complete bounded policy. |
| P2 trusted ingress | **Owner-gated proof remains open** | Existing source and redacted owner proof package are present in `docs/operations/trusted-ingress-*.md`; the live Cloudflare overwrite proof must not be inferred from prior blocked requests. |
| P2 migration rehearsal | **Partially fixed** | Fresh/disposable mobile migration evidence exists from the sixth pass. A seventh-pass ownership-cutover upgrade rehearsal and integrity report are still required. |
| P2 Android candidate provenance | **Partially fixed** | Existing candidate/source evidence exists, but there is no canonical release-candidate manifest driving all status documents and App-Link certificate validation. |
| P2 sync and offline value | **Confirmed open** | `synchronize-mobile-state.ts` uses coarse derived-cache invalidation. There is no bounded selected-collection download model. |
| P2 backup capacity | **Confirmed open** | Repository evidence records acknowledged-backup protections, but source lacks a reviewed dry-run acknowledgement/supersession eligibility policy. |
| P3 guardrails | **Partially fixed** | Existing native-config and route tests cover part of the boundary; seventh-pass static guardrails and indexed SQLite cache eviction remain required. |

## Existing safeguards confirmed

- Native mobile authorization defaults to disabled unless the exact
  `MOBILE_NATIVE_AUTHORIZATION_ENABLED=true` setting is present.
- Authorization-code exchange already has pre-body IP limiting and a bounded
  JSON reader.
- Access tokens are bound to a stable mobile device, and the local SQLite
  store records user and device ownership.
- Android configuration disables backup and prohibits cleartext traffic.
- The repository retains the approved release controller and explicit
  owner-approval boundary; this pass does not replace it.

## Pre-change verification state

| Command | Result |
| --- | --- |
| `npm run prisma:generate` | Passed |
| `npx prisma format --check` | Passed |
| `npx prisma validate` | Passed |
| `npm run api:openapi:check` | **Failed before seventh-pass source edits**: `docs/mobile/openapi-v1.json` is out of date at the starting revision. The generated contract is not silently changed during the baseline; a later phase will regenerate and review it with the route changes. |
| Focused containment route/configuration tests | Passed: 4 files / 16 tests after the Phase 1 correction; these are not a substitute for the full baseline suite. |

The remaining phase gates run in this worktree under Node 24. Any failure is
recorded with its environment or source cause before implementation is claimed
complete. No production-connected fixture is permitted.

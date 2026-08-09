# Fifth-pass current-state baseline

**Captured:** 2026-08-09  
**Status:** Phase 0 in progress — source baseline and locked local checks are
recorded; the dedicated disposable database/Redis/browser reproductions remain
to be added before this phase is closed.  
**Production interaction:** none

## Repository boundary

- **Baseline commit:** `686cd18b7e7f6196865af34c93496c3bddf16a69`
  (`Merge pull request #71 from wizkidword/codex/release-health-retry`).
- **Branch:** `codex/fifth-pass-phase-0`, created as a clean isolated worktree
  from `origin/main`.
- **Original checkout:** intentionally untouched. It is at `107377b`, is 170
  commits behind the upstream baseline, and contains unrelated guest-OPML
  changes.
- **Audit delta:** the fifth-pass plan names fourth-pass implementation commit
  `8112214`; the current baseline includes that work plus the later fourth-pass
  closeout and release-readiness commits through `686cd18`.

No SSH connection, Cloudflare operation, production container action,
production data operation, production migration, release, or browser action
was performed.

## Runtime inventory

| Component | Observed baseline |
| --- | --- |
| Node.js | `v24.18.0` |
| npm | `11.16.0` |
| Prisma | `7.8.0` |
| Docker Engine | `29.6.2` |
| Docker Compose | `v5.3.1` |
| PostgreSQL image | `postgres:17.10-alpine3.23` pinned by digest |
| Redis images | `redis:7.4.9-alpine3.21` pinned by digest for durable and ephemeral roles |
| Supported topologies | `all-in-one`, `all-in-one-with-chat`, `split`, `split-with-chat` |
| Committed migrations | `42` |

`npm ci --legacy-peer-deps` completed using Node 24 and generated the Prisma
client. npm reported ten dependency-audit findings (five moderate and five
high); this record does not change dependency versions or classify them as
production risk acceptance.

## Locked local verification

| Command | Result |
| --- | --- |
| `npm ci --legacy-peer-deps` | Passed; 875 packages installed and Prisma client generated. |
| `npm run prisma:generate` | Passed. |
| `npx prisma format --check` | Passed. |
| `npx prisma validate` | Passed. |
| `npm test` | Passed: 283 files, 1,388 tests; 4 files and 6 tests skipped. |
| `npm run typecheck` | Passed. |
| `npm run lint` | Passed. |
| `npm run build` | Passed; Next.js 16.2.11 generated 27 static pages. |
| `npm run topology:validate` | Passed for all four supported topologies. |
| `npm run compose:verify-env` | Passed. |
| `npm run compose:verify-dependencies` | Passed. |
| `npm run compose:verify-redis-boundaries` | Passed. |
| `npm run db:connection-budgets:verify` | Passed. |
| `npm run test:chat:release-gates` | Passed: 18 files and 113 tests. |

The authenticated Playwright suite and disposable PostgreSQL/Redis
reproductions have not yet been run for this pass. The Windows Docker runtime
also cannot establish the Linux `journald` Compose profile used for complete
production-profile runtime evidence. Those are explicitly not represented as
production or release evidence.

## Initial finding classification

| ID | Finding | Current classification | Evidence and next evidence |
| --- | --- | --- | --- |
| FP-001 | Disabled accounts can retain background automation | Confirmed | Fresh browser/chat checks use `disabledAt` and `authVersion`, but saved-monitor and Smart Digest schedulers/processors do not share an account-eligibility policy. Add worker-boundary tests before remediation. |
| FP-002 | OPML entry replay can finalize an entry more than once | Confirmed by schema/source review | `ImportJobEntry` has status and timestamp only; no lease, owner, or fencing token. Add a real PostgreSQL stalled-worker replay fixture. |
| FP-003 | A stale Smart Digest worker can still persist work | Confirmed by schema/source review | `DigestRun` uses a stale `processingStartedAt` check only; it has no lease owner or fence. Add a real PostgreSQL reclaim fixture. |
| FP-004 | Publisher failures can be mistaken for platform readiness failures | Pending dedicated reproduction | Current health/queue code is present but has not yet been fault-injected with publisher-only failures. |
| FP-005 | Publisher external identifiers can stress B-tree limits | Partially mitigated | Feed parsing enforces the existing external-ID byte limit, but indexed source text remains the identity boundary. Confirm the actual byte boundary and test the planned fixed-length identity migration. |
| FP-006 | Publisher control characters and dates need one boundary | Pending dedicated reproduction | Parser paths require focused hostile-XML/date fixtures before changing normalization. |
| FP-007 | Older source refreshes can overwrite newer results | Confirmed by schema/source review | Feed/podcast refresh writes have changed-only fingerprints but no persisted refresh generation, owner, or fencing field. Add an out-of-order refresh fixture. |
| FP-008 | Story membership must be current-version-only | Needs regression reproduction | Fourth-pass source includes a current-version-before-limit fix. Preserve it and prove split-history behavior before considering additional changes. |
| FP-009 | App shell should avoid source-hygiene payload/query work | Needs measurement | Fourth-pass reader projections are present; measure 10/100/200-feed payload and query behavior before altering it. |
| FP-010 | Redis and chat boundaries need least-privilege runtime proof | Static checks pass; runtime proof pending | Compose and role-boundary checks pass, but a disposable ACL allowed/denied matrix and full restricted-role Chat Compose run remain required. |

## Phase 0 exit status

This initial baseline is intentionally **not yet an exit claim**. It captures
the exact source state and fresh locked local results without mixing in
remediation. The next local slice is FP-001: establish one current-record
background eligibility policy, apply it at the existing monitor/digest
boundaries, and add focused tests. The final Phase 0 closeout must update this
record with the remaining reproductions and measurements before its status is
changed to complete.

# Fourth-pass implementation completion report

**Recorded:** 2026-08-09
**Scope:** Fourth-pass source implementation, local validation, and
non-executing release-readiness documentation.
**Production status:** No production connection, mutation, backup, deployment,
or operator verification was performed.

## Repository state

- **Audited starting commit:**
  `10896e19aa2a2151edff1bf550f0b3e56fcfe27e`.
- **Final implementation commit:** `8112214` (`test(e2e): allow explicit
  production server runtime`). This closeout documentation follows that
  implementation commit.
- **Branch:** `codex/fourth-pass-baseline`.
- **Implementation commits:** 34 commits from the audited starting commit
  through `8112214`.
- **Working tree:** expected clean after the closeout documentation commit.
  `git diff --check` passed before documentation was written.
- **Production changes:** `None`.

## Finding disposition

`Source/test complete` means the checked-in implementation and local evidence
are complete for the stated boundary. It does not mean deployed, live, or
operator-verified.

| Phase | Final status | What is now true in source | Remaining release boundary |
| --- | --- | --- | --- |
| 1–3: source job lifecycle and web action placement | Source/test complete | Terminal source jobs are removed after failure; later re-enqueue preserves deterministic IDs; manual and fallback refresh paths enqueue bounded worker work rather than fetching inline. | Verify selected worker topology and changed source flows after an approved release. |
| 4–6: deletion, ingestion budgets, changed-only persistence | Source/test complete | Deletion confirmation authenticates and rate-limits before costly work; feed and podcast parsing/fetching are bounded; identical source items avoid writes through versioned fingerprints. | Four related migration/behavior changes require exact-commit CI and production evidence before release. |
| 7: role and topology isolation | Source/test complete | Role-environment manifest, worker dependency boundaries, separate Redis ACL/network boundaries, and restricted chat database role are implemented and locally exercised. | Owner-approved credential rollout and selected OVH topology verification remain required. |
| 8: story and collection correctness | Source/test complete | Story signals use narrow authorized projections, current versions are selected before limiting, and owned collection references preserve deliberate article access. | Run the changed-flow smoke journey after release. |
| 9: health, backup, migration, and connection evidence | Source/test complete | Public health reads a compact worker snapshot; structured backup evidence and migration-risk records are enforced; connection budgets are verified statically. | Fresh real backup/restore, capacity, and migration-role evidence are operator work. |
| 10: lifecycle hardening | Source/test complete | One-active OPML admission, orphan reporting, bcrypt byte limits, bounded maintenance retries, and digest-pinned production bases are implemented. | Orphan deletion and legacy Redis removal remain intentionally deferred until owner-approved evidence exists. |
| 11: thin product improvements | Source/test complete | Source hygiene, durable collection explanations, briefing workflow guidance, bounded reversible monitor actions, and private account export are available in source. | Authenticate and smoke the changed flows after an approved deployment. |
| 12: local completion package | Source/test complete | The local gate, integration evidence, image-size record, audit ledger, roadmap, README, and this report are updated without a release action. | Exact commit CI, OVH preflight, and explicit owner approval remain mandatory. |

The detailed per-capability result and remaining owner gate are maintained in
[the fourth-pass capability status ledger](fourth-pass-capability-status.md).

## Migrations and compatibility windows

Four migrations were added after the audited baseline:

1. `20260808010000_add_ingestion_fingerprints` — nullable fingerprint fields;
   expand-only with legacy-null compatibility.
2. `20260808230000_enforce_one_active_opml_import_per_user` — partial unique
   index for pending/processing imports.
3. `20260809000000_add_saved_monitor_failure_tracking` — monitor failure and
   next-attempt tracking.
4. `20260809010000_add_feed_source_hygiene_observations` — nullable source
   hygiene observations.

`npm run migration:risk -- --base
10896e19aa2a2151edff1bf550f0b3e56fcfe27e` passed. Its advisory output flags
the OPML index and monitor-column migrations for their checked-in risk records;
it is not production approval. The migration records bind the reviewed SQL hash
and keep `Production ready: false` until fresh operator evidence exists.

The temporary legacy Redis compatibility path remains deliberately scoped.
Do not retire it before the compatibility-retirement checklist has the required
production evidence. The account-deletion v1 handoff window remains only for
its existing short lifetime; new handoffs use v2. No migration was added by
Phase 11D or Phase 12.

## Local validation evidence

All commands below used Node `v24.14.0` unless noted. Test infrastructure used
only script-owned disposable loopback containers and was removed afterward.

| Area | Evidence | Result |
| --- | --- | --- |
| Locked dependencies and schema | `npm ci --legacy-peer-deps`; Prisma generate, format check, and validate | Passed. |
| Source regression | `npm test` | 283 files passed, 4 skipped; 1,383 tests passed, 6 skipped. |
| Types, lint, build | `npm run typecheck`; `npm run lint`; `npm run build` | Passed; production build generated 27 static pages. |
| Migration review | `npm run migration:risk` and cross-base review | Passed; four reviewed migrations, two advisory findings, no unrecorded migration. |
| Topology/static boundaries | topology, Compose environment/dependency/Redis checks, legacy Redis check, connection budgets, runtime build | Passed. |
| Chat/security regression | `npm run test:chat:release-gates` | 18 files and 113 tests passed. |
| Real Redis | Source queue lifecycle and control-plane restart tests | 3 tests passed against a disposable Redis container. |
| PostgreSQL | Chat role/grant and OPML admission scripts | Passed against script-owned disposable PostgreSQL containers. |
| Browser | `E2E_PRODUCTION=1 ARCTIC_RSS_E2E_AUTHENTICATED=1 npm run test:e2e` with its production server explicitly launched by Node 24 | 10 authenticated and public browser journeys passed against disposable PostgreSQL and Redis services. |
| Production images | Four Docker targets built locally | Passed; current sizes are recorded in the baseline evidence. |
| Production dependencies | `node scripts/security/audit-production-dependencies.mjs` | Passed for 448 production packages. |

The local Windows Docker daemon lacks the `journald` logging driver required by
the production Compose profiles. Therefore the all-in-one/split Compose runtime
profiles were not started here. The CI workflow remains the exact-commit source
for Linux Compose startup/recovery, Trivy high/critical container scans, SBOM
artifacts, secret scanning, static analysis, and image-size artifact retention.

## Security boundaries verified in source

- Account export requires a fresh authenticated user, reader-owned queries,
  per-section/byte limits, rate limits, no-store headers, attachment download,
  and no persisted artifact. It excludes passwords, sessions, provider secrets,
  other users' data, and full publisher article bodies.
- Public health uses a compact durable-Redis snapshot; detailed diagnostics
  remain explicitly authenticated.
- Durable and ephemeral Redis use distinct ACL credentials and reviewed
  networks; the chat gateway has a restricted database role.
- Source parsing, discovery, OPML, and user-triggered work have bounded input,
  concurrency, retry, and ownership behavior.
- Migration-risk records are bound to the exact SQL and do not substitute local
  evidence for production measurements or approval.

## Deferred and owner-gated work

| Item | Why it is not complete | Required next action |
| --- | --- | --- |
| Production release and verification | Local tests and images do not prove current OVH health, capacity, backup freshness, or connector behavior. | Obtain exact-commit CI, run the approved read-only preflight, select topology, and type `DEPLOY <short-sha>` only when the owner approves. |
| Fresh backup and restore evidence | This needs the private production host and data; this work intentionally did not access either. | Record a fresh structured backup, off-host acknowledgement, and restore drill under the release runbook. |
| Production migration readiness | Local application on a disposable database does not supply table/lock/role/capacity measurements. | Review each unapplied migration with fresh evidence and the migration role preflight. |
| Linux Compose, image scans, and SBOMs | Windows Docker lacks `journald`; local Trivy and SBOM tools are not installed. | Require the exact commit's GitHub CI Compose, scan, and SBOM jobs. |
| Authenticated live changed flows | Disposable browser tests are not a live account or live source proof. | Smoke test source hygiene, collection retention, saved monitors/briefings, and account export after release. |
| Legacy Redis removal and orphan purge | Both are intentionally held behind real production migration/reference evidence; destructive purge is not enabled. | Follow their owner-gated retirement/purge runbooks separately. |
| Deferred product scope | External IRC, direct messages, public graphs/API/webhooks, generated transcription, shared workspaces, native mobile, offline sync, webpage capture, extra AI providers/model controls, another directory, and a standalone discovery portal are outside this plan. | Start a separately approved product plan if any becomes a priority. |

## Prepared release package — do not execute

The approved release command and rollback runbook are already in the
repository. This completion package does not run them. A future release must
require all of the following:

1. A clean checkout whose `HEAD` exactly matches `origin/main`.
2. Successful required GitHub CI checks for that exact commit.
3. Reviewed migration SQL/risk records and fresh production lock, role,
   capacity, backup, and restore evidence where migrations apply.
4. An explicit supported topology and exact immutable image digests.
5. Environment-manifest validation and independently healthy local/public
   health plus login before any dry run or release.
6. A fresh explicit owner command: `DEPLOY <short-sha>`.

No CI success, local test result, source commit, or preflight result is a
substitute for that command.

## Rollback, forward recovery, and post-release smoke

The release command retains the prior source and exact images for a code-only
rollback. A schema-incompatible change must use a matching verified backup or
a reviewed forward repair; code rollback is not a database rollback.

After an approved release, perform these exact smoke checks before calling it
complete:

1. Public `/api/health` and `/login`; protected `/api/internal/health` must
   remain protected.
2. Selected topology services, worker health snapshot/heartbeat, monitor, and
   durable/ephemeral Redis boundaries.
3. Add/retry a source without waiting for an inline refresh; check source
   hygiene display and safe replacement path.
4. Save an article, unsubscribe, reopen through its owned collection, then
   remove it and confirm ordinary access disappears.
5. Save a search, inspect bounded monitor status, create/review a Smart Digest,
   and confirm monitor actions remain reversible.
6. Download an account export and confirm it is a private attachment with the
   documented bounded sections only.

## Final recommendation

```text
NOT READY FOR PRODUCTION WITHOUT OWNER APPROVAL
```

The fourth-pass source implementation and local validation are complete. The
remaining work is intentionally outside source authority: exact-commit CI,
fresh OVH readiness/backup/restore/capacity evidence, a selected topology, and
an explicit `DEPLOY <short-sha>` approval. No production state changed.

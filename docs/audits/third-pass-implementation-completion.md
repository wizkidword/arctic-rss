# Third-pass implementation completion report

**Recorded:** 2026-08-08
**Scope:** Third-pass work plan implementation and local verification
**Production status:** No deployment, production mutation, or operator verification was performed.

## 14.1 Repository state

- **Starting commit:** `e227dad36a73b045b34dd9e4ad34c6fcc6e5aaf7`.
- **Ending commit:** this documentation commit (the branch `HEAD` once it is
  created).
- **Branch:** `codex/third-pass-stabilization`.
- **Commits created:** 5, including this documentation commit.
- **Working tree:** expected clean after this commit, except for the
  pre-existing untracked `.npm-cache/` directory. It is not part of this work
  and was not removed or staged. `git diff --check` passed before committing.
- **Major modified areas:** reader shell/navigation and projections; health, doctor, deletion, source-subscription, search, and worker code; release, environment, migration-risk, security, roadmap, and readiness documentation.
- **Major added areas:** role-environment manifest/configuration, migration-risk classifier and reports, health snapshot and deletion-handoff helpers, responsibility-focused action/article/reader/worker modules, source-attention controls, third-pass audit/performance/decision records, and focused tests.
- **Dependency remediation:** the existing override block now pins `@hono/node-server` 1.19.17, `hono` 4.13.1, `js-yaml` 4.3.1, and `nanoid` 3.3.18. The lockfile was regenerated without changing direct dependencies.

## 14.2 Finding disposition

`Partial` below is deliberate: local source and regression evidence is not a claim of production release or operator validation.

| Finding | Final status | Implementation | Tests | Remaining risk |
| --- | --- | --- | --- | --- |
| P1-01 related-story hydration | Partial — locally closed | Authorized metadata-only related-story projection; no body, AI, or HTML hydration. | Focused projection tests, full suite, and synthetic reader evidence. | Release and authenticated production smoke remain. |
| P1-02 duplicate navigation hydration | Partial — locally closed | Lazy mobile navigation plus one shared feed-menu controller. | Component/shell tests and public browser smoke; 10/100/200-feed local measurement. | Production device/usage evidence remains. |
| P2-01 doctor semantics | Partial — locally closed | Explicit runtime, host, migrations, and release scopes with centralized exit evaluation. | Doctor exit-semantics tests in the full suite. | Enforcing scopes were not run against an owner-approved host. |
| P2-02 migration risk | Partial — locally closed | SQL classifier, checked-in report convention, CI/release wiring. | Classifier tests and `migration:risk` report for this diff. | No migration was added; production preflight remains owner-gated. |
| P2-03 environment manifest | Partial — locally closed | One role manifest drives validation and documented service boundaries. | Exact Compose-manifest validator passed. | Runtime Compose profiles could not start on this Windows Docker host. |
| P2-04 deletion handoff | Partial — source/test complete | Logged-out, cross-device confirmation handoff and one-active-confirmation protection. | Route, helper, action, and concurrency regressions in full suite. | Authenticated cross-device browser journey remains unexecuted. |
| P2-05 maintainability | Partial — locally closed | Actions, article projections, reader presentation, and worker lifecycle split by responsibility while retaining stable exports. | Full suite, typecheck, lint, runtime build, and public smoke. | Normal post-release behavior observation remains. |
| P2-06 layout efficiency | Partial — locally measured | Narrow shell selections and preserved grouped reader counters. | 10/100/200 synthetic browser measurements and regression coverage. | No production database tracing or production timing claim. |
| P3-01 source quota before discovery | Partial — source/test complete | Subscription quota is checked before outbound discovery and remains transaction-safe. | Focused subscription tests in full suite. | Authenticated end-to-end confirmation remains. |
| P3-02 one active deletion confirmation | Partial — source/test complete | Single active confirmation invariant and race-safe handoff behavior. | Focused concurrency tests in full suite. | Production migration/release and browser verification remain. |
| P3-03 legacy Redis compatibility | Deferred by design | Compatibility path remains scoped and documented; removal is blocked on production evidence. | Compatibility-boundary validator passed. | Removing it early could break production migration compatibility. |
| P3-06 Redis server identity diagnostics | Partial — source/test complete | Host/release doctor scopes compare normalized endpoint and server identity safely. | Doctor tests in full suite. | Requires owner-approved host diagnostics. |
| P3-07 transcript single-flight | Partial — locally closed | Normalized same-URL cache misses coalesce and clean up after success/failure. | Focused concurrency tests plus full suite. | Production observability remains. |

## 14.3 Test evidence

### Unit, integration, and security regression

**Command:** `npm test`
**Result:** Passed. 262 test files passed, 2 files skipped; 1,225 tests passed, 3 skipped.
**Duration:** 15.29 seconds.
**Notes:** Skips are existing environment-gated cases.

**Command:** `npm run test:chat:release-gates`
**Result:** Passed. 18 files and 106 tests passed.
**Duration:** 2.32 seconds.
**Notes:** Covers chat, CSP, runtime, worker shutdown, and recovery regressions.

**Command:** `node scripts/security/audit-production-dependencies.mjs`
**Result:** Passed for 448 package names.
**Duration:** under one second.
**Notes:** After the targeted overrides, no high/critical production dependency advisory remains. `npm audit --omit=dev --audit-level=high` also exited 0. Two moderate advisories remain behind `@modelcontextprotocol/sdk`'s `@hono/node-server` dependency and require a breaking-major dependency path; they are documented, not silently ignored.

### Typecheck, lint, formatting, schema, and build

**Command:** `npm run typecheck`
**Result:** Passed.
**Duration:** included in the final 84.9-second local build gate.
**Notes:** No TypeScript errors.

**Command:** `npm run lint`
**Result:** Passed with 0 errors and 1 warning.
**Duration:** included in the final local build gate.
**Notes:** The warning is the pre-existing unused `key` parameter in `src/lib/redis-initial-connection.test.ts`.

**Command:** `node node_modules/prisma/build/index.js format --check`
**Result:** Passed; all files formatted.
**Duration:** under ten seconds in the final policy gate.
**Notes:** No formatting rewrite was applied.

**Command:** `node node_modules/prisma/build/index.js validate`
**Result:** Passed; Prisma schema is valid.
**Duration:** under ten seconds in the final policy gate.
**Notes:** No schema migration is part of this diff.

**Command:** `npm run runtime:build`
**Result:** Passed.
**Duration:** under ten seconds in the final policy gate.
**Notes:** Chat/runtime build artifact generation succeeded.

**Command:** `npm run build`
**Result:** Passed; optimized Next.js production build completed.
**Duration:** included in the final 84.9-second local build gate; TypeScript within that build finished in 15.9 seconds.
**Notes:** All 27 static pages generated successfully.

### Browser

**Command:** `E2E_PORT=3100`, `APP_ORIGIN=http://localhost:3100`, `APP_ALLOWED_HOSTS=localhost:3100,127.0.0.1:3100`, `CI=1`, then `npm run test:e2e`
**Result:** Passed: 3 public/CSP/liveness tests passed; 5 authenticated tests skipped.
**Duration:** 8.8 seconds.
**Notes:** A test-specific non-secret origin/allowlist was supplied so the isolated local server exercised host validation correctly. The CSP probe emits expected rate-limit logs because no trusted client identifier is present.

**Earlier browser attempts:** The default port 3000 run reached an unrelated already-running local server and failed. The first isolated run omitted its test-port origin/allowlist and was rejected by host validation. Neither result was used as evidence; no application code was weakened. The final isolated run above is the valid result.

**Not executed:** The five authenticated Playwright journeys require the disposable database, Redis, and fixture stack. They remain a release/CI gate.

### Compose, migration risk, doctor, and policy boundaries

**Command:** `npm run topology:validate`
**Result:** Passed for all-in-one, all-in-one-with-chat, split, and split-with-chat.
**Duration:** under ten seconds.
**Notes:** Static topology ownership validation only.

**Command:** `npm run compose:verify-env`
**Result:** Passed; Compose service environment boundaries exactly match the manifest.
**Duration:** under ten seconds.
**Notes:** No runtime profile was started.

**Command:** `npm run compatibility:verify-legacy-redis`
**Result:** Passed.
**Duration:** under ten seconds.
**Notes:** The temporary compatibility boundary remains intentionally scoped.

**Command:** `npm run migration:risk -- --base e227dad36a73b045b34dd9e4ad34c6fcc6e5aaf7`
**Result:** Passed: `{ "migrations": [], "status": "ok" }`.
**Duration:** under ten seconds.
**Notes:** No new migration is in the third-pass diff.

**Command:** `git diff --check`
**Result:** Passed.
**Duration:** under ten seconds.
**Notes:** Git printed CRLF normalization notices only; no whitespace error.

**Doctor exit semantics:** covered by the passing full Vitest suite. An actual `npm run doctor` enforcing scope was not run because it requires the selected runtime/host and is not a substitute for owner-approved production preflight.

**Compose runtime attempt:** An isolated disposable PostgreSQL Compose project was attempted for the search benchmark and failed before startup because this Windows Docker daemon does not enable the stack's required `journald` logging driver. Its container, network, and volume were removed. All-in-one, split-worker, chat, and tunnel runtime profiles are therefore unexecuted here.

**GitHub-only checks not executed locally:** full-history secret scan, CodeQL, container vulnerability scans, SBOM generation, and the GitHub dependency review action. These remain required CI evidence for a reviewed commit.

## 14.4 Performance evidence

The complete local reader-shell evidence is in [third-pass reader and shell results](../performance/third-pass-reader-shell-results.md). It used a disposable authenticated fixture with 10, 100, and 200 feeds and keeps production claims out of the result:

| Area | Before | After / observed local evidence | Limitation |
| --- | --- | --- | --- |
| Related-story projection, 5 body-heavy articles | 146,309 B serialized detail result | 1,024 B metadata result (99.3% avoided) | In-process warm sample, not PostgreSQL wire tracing. |
| Related-story projection, 20 body-heavy articles | 585,223 B | 4,083 B (99.3% avoided) | Same synthetic fixture. |
| Persistent feed-menu owners, 10/100/200 feeds | 20 / 200 / 400 | 1 / 1 / 1 shared controller | Structural count, not heap profiling. |
| Authenticated shell JS transfer, 10/100/200 feeds | No historical A/B browser value | 290,652 B / 290,652 B / 290,652 B | Implemented-result measurement only. |
| Transcript same-URL concurrency | Multiple cache misses could fetch repeatedly | 10 concurrent misses made one outbound request in focused test | Synthetic test, not production traffic. |
| Public health concurrency | Previously direct dependent checks | Cached single-flight health code and regression tests | No live public load test or production probe. |

Search telemetry and retained historical synthetic plan evidence are in [search query-plan and telemetry evidence](../performance/search-query-evidence.md). A fresh synthetic 30,000-article run could not start on this Docker host due to the unavailable `journald` driver; no new index was added without fresh plan justification.

## 14.5 Migration and deployment evidence

- **New migrations:** none in this third-pass diff.
- **Risk classification:** passed with no changed migrations.
- **Production migration result:** not run.
- **Deployed image/commit:** not applicable; nothing was deployed.
- **Selected production topology:** not selected in this worktree; static validation covers the supported topology names only.
- **Health and heartbeat result:** local source/test evidence only; no production or operator verification was performed.
- **Rollback/forward recovery:** no release occurred, so no rollback action was needed. The updated rollback runbook and deployment boundary remain the source of truth for an approved release.

## 14.6 Product changes

- Kept related coverage inside the reader and made it cheaper to load.
- Consolidated reader navigation behavior and delayed mobile navigation work until opened.
- Added signed-in source attention with retry, pause, bounded bulk retry/pause, and typed unsubscribe confirmation; raw fetch errors are not displayed.
- Let monitor-enabled saved searches prefill a Smart Digest draft and added a plain-language briefing workflow guide.
- Kept first-run onboarding focused on importing subscriptions or selecting a starter set.
- Added clear wording that generated summaries and digests derive from source articles and do not replace publisher wording.
- Recorded the decision not to add a separate `Today` destination in `docs/product-decisions/today-composition.md`.

Deferred: scheduled reader rules, a separate Today portal, unbounded bulk source actions, new search indexes without plans, generated audio transcripts, and legacy Redis removal before production evidence.

## 14.7 Deferred or owner-gated work

| Item | Why incomplete | Code ready? | Exact owner action required | Risk of deferral / safe next step |
| --- | --- | --- | --- | --- |
| CI and production release | The reviewed five-commit branch is not yet pushed through CI, and no deployment approval was supplied. | Local source gates pass. | Push the branch, require CI success, then approve `DEPLOY <short-sha>`. | Do not deploy before remote CI and explicit typed approval. |
| Production preflight and verification | Requires private OVH host, selected topology, real health/login checks, and operator recovery access. | Source/runbooks ready; environment not exercised. | Run the owner-approved OVH preflight and release verification. | Local success does not prove live readiness. |
| Authenticated browser journeys | Requires disposable database/Redis/feed-fixture stack. | Tests are present. | Run the authenticated Playwright gate in CI or a compatible disposable environment. | Private reader/deletion/source workflows lack final browser confirmation. |
| Compose runtime profiles and search benchmark | Windows Docker lacks `journald`, required by the checked-in Compose logging configuration. | Static validators and benchmark guardrails pass. | Use a compatible disposable Linux Docker host, then run selected Compose profiles and `ARCTIC_RSS_SEARCH_BENCHMARK_CONFIRM=disposable npm run search:measure`. | Do not infer runtime topology or query plans from static checks. |
| Moderate transitive Hono advisories | The remaining fix crosses a dependency major through `@modelcontextprotocol/sdk`. | High/critical production dependency gate passes. | Review and separately approve a compatible major-path upgrade or removal of the dependency. | Moderate advisory remains; do not hide it behind the passing high/critical CI threshold. |
| Legacy Redis compatibility retirement | Production migration evidence is intentionally missing. | Guard and retirement checklist are ready. | Follow the owner-gated compatibility retirement checklist after production evidence exists. | Early removal could interrupt a supported migration path. |

## 14.8 Final recommendation

```text
NOT READY FOR PRODUCTION
```

The source implementation, local test suite, production build, public browser smoke, schema/policy checks, and high/critical production dependency check pass. That is necessary but not sufficient. GitHub CI, compatible runtime Compose evidence, authenticated browser journeys, owner-approved OVH preflight, explicit `DEPLOY <short-sha>` authorization, and live health/login/changed-flow verification are still required. No production state was changed.

# Arctic RSS third-pass implementation baseline

**Recorded:** 2026-08-08
**Audit baseline:** `e227dad36a73b045b34dd9e4ad34c6fcc6e5aaf7` (2026-08-03T23:58:32-04:00)
**Implementation branch:** `codex/third-pass-stabilization`

## Repository state

- Current branch: `codex/third-pass-stabilization`.
- Current commit: `e227dad36a73b045b34dd9e4ad34c6fcc6e5aaf7`.
- Commit subject: `Merge pull request #60 from wizkidword/codex/second-pass-phase-0`.
- Working tree: clean before this baseline document.
- Remote truth: the GitHub `main` ref resolves to the same audit commit; there
  are no commits or changed files between the audit baseline and this checkout.
- The older local `main` checkout was 116 commits behind and had unrelated
  guest-OPML work in progress. It was not changed. This isolated checkout was
  reconstructed from the verified local Git object for the current remote
  commit because direct Git transport is unavailable in this session.

## Current architecture

The repository defines a Next.js 16 web service and one one-shot `migrate`
service. It supports exactly one worker topology at a time: `worker` in the
`all-in-one` profile, or the split `worker-ingestion`, `worker-ai-mail`,
`worker-imports`, and `worker-maintenance` services, with
`worker-chat-events` added only for chat topologies. PostgreSQL, durable
Redis, and ephemeral Redis are private dependencies; durable Redis uses AOF
and `noeviction`, while ephemeral Redis is non-persistent and TTL-oriented.
`chat-gateway` and `edge-proxy` are opt-in `chat` profile services, and
`cloudflared` is an opt-in `tunnel` profile service. See
`docker-compose.yml`, `ops/topologies.json`, and
`docs/operations/deployment-topologies.md`.

`docker compose config --services` was attempted without an environment file
and correctly stopped at the required `POSTGRES_PASSWORD` interpolation gate.
No environment values were read or supplied. Static Compose inspection and
the topology manifest establish the supported services above.

## Finding revalidation

| Finding | Audit status | Current status | Evidence | Planned action |
| --- | --- | --- | --- | --- |
| P1-01 related-story hydration | Open | Open | `src/lib/story-cluster-reader.ts` loads `listReaderArticlesByIdsForUser`; `src/lib/articles.ts` maps those records through `mapReaderArticle`, selecting bodies, AI detail, state, and sanitizing HTML. | Replace this presentation load with a dedicated authorized metadata projection and regression tests. |
| P1-02 duplicate navigation hydration | Open | Open | `src/components/app-shell.tsx` renders `ReaderNav` for both desktop and the mounted mobile `Sheet`; feed navigation owns per-feed context-menu controls. | Lazily mount the mobile tree and bound menu ownership after P1-01. |
| P1-03 public health expense | Open | Partial | `src/app/api/health/route.ts` exposes only a redacted status, but calls `checkSystemHealth()` on every `no-store` request. | Split cached, single-flight public status from protected detailed diagnostics. |
| P2-01 doctor exit semantics | Open | Partial | `scripts/doctor.ts` is role-aware but its exit code considers only security-boundary and queue readiness; it has no explicit runtime, host, migrations, or release scopes. | Add a single result evaluator and scoped command model. |
| P2-02 migration risk | Open | Open | Migration ownership preflight exists in `scripts/windows/deploy-approved-release.ps1`, but no SQL risk classifier or checked-in migration-risk report exists. | Add classifier, reports, CI/release enforcement, and documentation. |
| P2-03 role environment source of truth | Open | Partial | Compose has explicit service environments and `compose:verify-env`; role requirements are separately represented in `src/lib/doctor.ts`, `src/lib/production-security.ts`, and documentation. | Consolidate required, optional, and forbidden variables in one checked-in manifest. |
| P2-04 OAuth deletion handoff | Open | Partial | `src/lib/account-deletion.ts` creates a hashed, fragment-carried confirmation token and the confirmation route requires the current user; focused unit coverage exists. | Verify and complete the logged-out/cross-device browser handoff and preserve the current secret boundary. |
| P2-05 orchestration module size | Open | Partial | `src/app/app/actions.ts` has already delegated reader and AI actions, but `src/lib/articles.ts`, `src/components/reader-surface.tsx`, and `worker/index.ts` remain large orchestration targets. | Split only responsibility seams, preserving stable exports. |
| P2-06 authenticated layout work | Open | Partial | `src/app/app/layout.tsx` already parallelizes its independent shell loads, but its full query inventory and 10/100/200-feed measurements are absent. | Audit selections and query counts before changing shell data flow. |
| P3-01 source quota before discovery | Open | Partial | `src/lib/feed-subscriptions.ts` has an atomic quota check, but performs `discoverFeedFromUrl()` before that check. | Move the rejection gate before outbound discovery while retaining the transactional guard. |
| P3-02 one active deletion confirmation | Open | Partial | The token request invalidates current rows before creating one, but `AccountDeletionConfirmationToken` has no active-token database invariant. | Add a concurrency-safe invariant and race test. |
| P3-03 temporary compatibility retirement | Open | Open | `src/lib/redis-config.ts` and `src/lib/production-security.ts` still support the scoped legacy `REDIS_URL` migration flag. | Establish production evidence before removing the compatibility path. |
| P3-06 Redis server identity diagnostics | Open | Open | Doctor reports URL separation but has no `host` scope or authenticated `INFO server` identity check. | Add redacted host diagnostics and release documentation. |
| P3-07 transcript single-flight | Open | Open | `src/lib/podcast-transcript.ts` has cache and concurrency limits but no normalized-URL in-flight promise map. | Add bounded same-URL coalescing with failure cleanup. |

## Commands and initial verification

| Command | Result | Notes |
| --- | --- | --- |
| `git status --short --branch` | Passed | Clean isolated baseline branch before this document. |
| `git rev-parse HEAD` and `git log -1` | Passed | Both identify `e227dad36a73b045b34dd9e4ad34c6fcc6e5aaf7`. |
| `git diff --stat e227dad..HEAD` | Passed | Empty: this checkout is the audit baseline. |
| GitHub ref lookup for `main` | Passed | Resolved to the same SHA through the authenticated GitHub client. |
| `docker compose config --services` | Blocked as expected | Required local Compose values were deliberately not supplied. |
| Node 24 dependency install | Passed | Installed with scripts disabled because the app default is Node 20; repository declares Node 22+. |
| Prisma client generation | Passed | Generated Prisma Client 7.8.0 with the bundled Node 24 runtime. |

The remaining static and test gates will be run against each implementation
slice, followed by the full repository gate at the end of a completed phase.
No production, database, tunnel, DNS, or deployment operation was performed.

## First implementation slice

P1-01 is the active slice. It has a direct, low-risk seam: the cluster
presentation needs only article ID, title, URL, publication time, and feed
title, while the current loader is a reader-detail loader. The replacement
will retain the existing user subscription and archive authorization predicate,
avoid article-body selection and HTML sanitization, and preserve deterministic
presentation ordering.

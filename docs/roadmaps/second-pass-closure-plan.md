# Arctic RSS second-pass closure plan

**Purpose:** close the remediation program with evidence rather than repeat its
implementation backlog. This is the successor to the July 2026 second-pass
plan. It separates source completion, OVH rollout, and production proof before
any Arctic Story Intelligence work begins.

**Reviewed:** 2026-07-28
**Scope:** private Arctic RSS repository and the current OVH production host.
This document does not authorize a deployment, provider change, DNS change,
database restore, or production fault injection.

## Operating rules

- Keep the repository private and operational configuration outside Git.
- Treat OVH as the only production environment. Do not reuse Hetzner host
  details, capacity assumptions, or commands.
- A commit is not live merely because it passed CI. A production application
  release requires a fresh typed `DEPLOY <short-sha>` approval.
- Do not run a full production Docker build until the release method and OVH
  capacity have been checked for that exact release. Prefer an off-host or
  staged build path if the safety margin is not clear.
- Preserve the prior release and verified PostgreSQL backup before every
  approved production mutation.

## Reconciliation snapshot

| Area | Evidence on 2026-07-28 | State |
| --- | --- | --- |
| Source baseline | `origin/main` is `107377b`; it contains implementation commits for every P1–P3 remediation item in the original plan. | Code complete, subject to live parity. |
| Local follow-up commits | This branch is three commits ahead: Sharp standalone assets, backup failure alert wiring, and polished alert email. | Not pushed. |
| CI | The latest CI run for `107377b` passed. | Proven for `107377b`, not the three local commits. |
| Focused regression gates | 111 focused chat, worker, image, monitor, and backup tests passed locally. | Proven locally. |
| Static validation | A bounded Windows harness completed full Vitest naturally (209 files, 932 tests) and Prisma format/validation. Typecheck and lint exit 0; lint retains two pre-existing unused-parameter warnings. The production build compiled and the standalone Sharp runtime loaded. | Local gate verified. |
| Public surface | Canonical health returned `200 {"status":"ok"}` and login returned `200` with a password field. | Live and verified. |
| OVH runtime | Web, worker, chat gateway, PostgreSQL, durable Redis, and ephemeral Redis are healthy. All expected schema migrations are applied. | Live and verified. |
| Release provenance | The active source directory is not a Git checkout and no current release revision is discoverable from the host. | Open. |
| Backups and alerts | Daily backup and monitor timers are active; latest backup is complete; the off-host sync task last succeeded; alert delivery is configured and SMTP-accepted. | Live and verified. |
| Redis condition | Durable and ephemeral Redis are healthy but both remain above the monitor's fragmentation threshold. | Open operational condition; do not restart Redis casually. |
| Worker isolation | The compatibility `worker` is live. The five-service `split-workers` profile is available in source but intentionally not activated. | Deliberately deferred cutover. |
| Image runtime | Minimal compiled images are in source. The local Sharp standalone-runtime fix is not in a reviewed/pushed release. | Open release item. |

## Original-plan reconciliation

The original P1–P3 remediation work exists in source, schema migrations, and
focused tests. The missing distinction is production acceptance evidence.

| Original scope | Current source status | Closure needed |
| --- | --- | --- |
| CHAT-AUTH-001 and CHAT-REDIS-001 | Implemented with security-event revocation, bounded reauthorization, readiness behavior, reconnect recovery, and controlled restart tests. | Prove the reviewed release is live, then run the documented beta-account acceptance checks in an approved window. |
| Moderation, holds, AI leases, and database-secret hardening | Implemented with committed migrations and focused transaction/recovery tests. | Record migration and release provenance; recheck the safe zero-count anomaly queries after the approved release. |
| WebSocket abuse, read markers, slow mode, presence, blocks, outbox, and retention | Implemented and covered by focused gateway/service tests. | Verify the exact release, gateway behavior, and worker/outbox metrics without exposing message or user data. |
| Redis architecture and worker lifecycle | Two Redis services are live; graceful shutdown and split-worker code are present. | Diagnose fragmentation first; separately approve and observe the split-worker cutover. |
| Minimal images, CSP, CI gates, and trusted ingress | Source, CI controls, and runbooks are present; latest main CI passed. | Add release provenance and verify headers/image contents for the approved deployed commit. |
| AUTH-PERF-001, CHAT-SEQ-001, IMAGE-PROXY-001 | Implemented/decided in `origin/main`; image proxy has re-encoding tests. | Include them in the exact-release verification; include the Sharp fix with that release. |

## Milestone 0 — Make the release gate reproducible

**Goal:** a release candidate can be checked locally and in CI without an
ambiguous hanging command.

**Status: completed 2026-07-28.**

- A bounded harness showed that full Vitest terminates naturally after 209
  files and 932 tests; the earlier terminal result had returned before its
  child process completed.
- Prisma validation terminates naturally. A Windows `core.autocrlf=true`
  checkout had changed `prisma/schema.prisma` to CRLF, which Prisma rejects as
  unformatted. `.gitattributes` now explicitly retains LF for that schema. A
  fresh temporary worktree verified both the attribute and `prisma format --check`.
- Typecheck, Prisma format/validation, and the production build passed. Lint
  exits successfully with the two existing unused-parameter warnings; they are
  recorded as non-blocking cleanup rather than hidden or suppressed.

## Milestone 1 — Prepare a traceable release candidate

**Goal:** turn source changes into one reviewable, reproducible candidate.

1. Review and push the three local commits as a small private change set:
   Sharp standalone assets, backup-failure notification wiring, and alert
   presentation. The alert scripts are already installed on OVH; this step
   brings Git history into parity without pretending it is an application
   deployment.
2. Wait for fresh CI on the exact candidate SHA. Do not rely on CI for
   `107377b` after the candidate changes.
3. Update the private release record/process so the deployed archive or image
   records its source revision without copying secrets into labels, logs, or
   public responses.
4. Recheck the current OVH release procedure and capacity immediately before
   any build. The 2026-07-28 snapshot had substantial free memory and disk,
   but that is not a blanket authorization for an on-host build.

**Approval boundary:** pushing is not a production deployment. The next step
requires a fresh typed `DEPLOY <short-sha>` after CI is green.

## Milestone 2 — Approved application release and parity proof

**Goal:** deploy the candidate once, safely, and prove it matches source.

1. Before any mutation: verify a current PostgreSQL backup, rollback release,
   clean working tree, exact candidate SHA, CI, OVH capacity, and the reviewed
   staged/off-host build procedure.
2. Use the approved release command's staged archive, hash verification,
   migration status, narrow service recreation, and health checks. Do not
   rebuild data services or alter Cloudflare, DNS, or firewall settings.
3. Record source SHA, image identity, migration status, and release timestamp
   in the private release record. This closes the current provenance gap.
4. Verify canonical health, login, Docker health, gateway readiness, monitor
   result, backup timer, CSP headers, image-proxy behavior, and safe database
   anomaly queries.

**Done when:** the exact source revision can be tied to the running release
and the relevant P1–P3 acceptance evidence is recorded.

## Milestone 3 — Operational stabilization decisions

**Goal:** finish the items that require an operational choice rather than more
source code.

### 3A. Redis fragmentation

1. Gather non-mutating memory, allocator, keyspace, command-pressure, AOF,
   and eviction evidence for both Redis workloads.
2. Identify whether the ratios are allocator fragmentation, workload churn,
   or capacity pressure. Keep alerting enabled while investigating.
3. Propose the smallest safe corrective action and rollback plan. A Redis
   restart, config change, or provider resize requires explicit authorization.

### 3B. Split workers

1. Observe the all-in-one worker's memory, queue backlog, and job latency on
   the reviewed release.
2. If isolation is justified, propose a separate cutover using the documented
   `split-workers` profile. Stop the compatibility worker before starting the
   five isolated workers; never run both ownership models as steady state.
3. Verify all five health checks, queue ownership, maintenance lease behavior,
   resource headroom, and rollback to the compatibility worker.

**Approval boundary:** either cutover changes production workload ownership and
requires a separate explicit approval.

## Milestone 4 — Close operations evidence

**Goal:** replace stale or duplicate references with current OVH evidence.

1. Refresh `current-production-inventory.md` after the approved release and
   mark the exact live state of split workers and compiled images.
2. Remove or update the remaining public documentation reference to Hetzner;
   do not copy host details into repository files.
3. Consolidate the original Phase 0 names into the current inventory,
   backup/restore checklist, chat-gateway recovery guide, deployment rollback
   runbook, and a concise worker/queue ownership map.
4. Revalidate an isolated restore rehearsal before its due date and at least
   quarterly thereafter. Do not reuse or modify historical failed attempts.
5. Keep a short private evidence record for backup freshness, off-host sync,
   alert delivery, monitor state changes, and release provenance.

**Done when:** backup, restore, monitoring, rollback, and deployment facts are
current, reproducible, and OVH-specific.

## Product gate — Arctic Story Intelligence

Do not start product work until Milestones 0–2 are complete and Milestone 3A
has a documented decision. Then start one thin vertical slice only:

1. **PRODUCT-STORY-001A — private full-text search.** Search articles readable
   by the current user, retain existing authorization boundaries, paginate,
   and record query-performance evidence.
2. **PRODUCT-STORY-001B — saved monitors.** Add a constrained named saved
   search on top of the proven search model; do not add automation or AI
   briefings in the same release.

Story clustering, timelines, Story Rooms, delta briefings, automation, and
transcripts remain later work. Each needs its own data-retention, cost,
authorization, and release plan.

## Resume checklist

Before starting any milestone, recheck:

- `git status --short --branch`, remotes, worktrees, and candidate SHA;
- current CI for that SHA;
- public health and login;
- OVH container/timer health, backup freshness, disk/memory headroom, and
  monitor state without printing operational configuration;
- the private release record's provenance and rollback entry; and
- whether the next action crosses an approval boundary.

Report every completed milestone in plain English with: what changed, what was
verified, Git status (local/pushed), deployment status, and the next open
item.

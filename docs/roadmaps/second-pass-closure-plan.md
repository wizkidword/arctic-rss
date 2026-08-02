# Arctic RSS second-pass closure plan

**Purpose:** close the remediation program with evidence rather than repeat its
implementation backlog. This is the successor to the July 2026 second-pass
plan. It separates source completion, OVH rollout, and production proof before
any Arctic Story Intelligence work begins.

**Reviewed:** 2026-07-29
**Scope:** Arctic RSS repository and the current OVH production host.
This document does not authorize a deployment, provider change, DNS change,
database restore, or production fault injection.

## Operating rules

- The repository is public by the owner's 2026-07-28 decision so GitHub's
  no-cost CodeQL service can run. Keep all operational configuration, release
  records, credentials, backup material, and OVH details outside Git.
- Treat OVH as the only production environment. Do not reuse legacy-provider
  host details, capacity assumptions, or commands.
- A commit is not live merely because it passed CI. A production application
  release requires a fresh typed `DEPLOY <short-sha>` approval.
- Do not run a full production Docker build until the release method and OVH
  capacity have been checked for that exact release. Prefer an off-host or
  staged build path if the safety margin is not clear.
- Preserve the prior release and verified PostgreSQL backup before every
  approved production mutation.

## Publication decision

**Resolved 2026-07-28.** The owner explicitly chose public visibility to keep
GitHub's no-cost CodeQL scanning available rather than purchase GitHub Code
Security for a private repository. The source history is consequently public;
do not add operational details, release records, credentials, backup material,
or any user data to the repository. A future visibility change remains a
provider-side decision requiring explicit authorization.

## Reconciliation snapshot

| Area | Evidence on 2026-07-29 | State |
| --- | --- | --- |
| Source baseline | `origin/main` is `69fc286`; the running web/worker release remains `74ffd3f`. Main contains the P1–P3 remediation work, Story Intelligence slices, the OVH Compose compatibility correction, and the approved off-host image-metadata fix. | The private release record and running web/worker image tags agree for `74ffd3f`; the newer main revision is not deployed. |
| Candidate commits | The current release includes private full-text search, saved searches, transparent story clustering, cited timelines, and optional cited analysis in addition to the remediation work. | Deployed with web/worker and verified through the release record. |
| CI | Exact-commit main CI passed for `74ffd3f`, including the container scan/SBOM, browser, Compose, quality, secret, dependency, and static-analysis gates. | Verified before release. |
| Focused regression gates | 111 focused chat, worker, image, monitor, and backup tests passed locally. | Proven locally. |
| Static validation | A bounded Windows harness completed full Vitest naturally (209 files, 932 tests) and Prisma format/validation. Typecheck and lint exit 0; lint retains two pre-existing unused-parameter warnings. The production build compiled and the standalone Sharp runtime loaded. | Local gate verified. |
| Public surface | Canonical health returned `200 {"status":"ok"}` and login returned `200`. | Live and verified. |
| OVH runtime | Web, worker, PostgreSQL, durable Redis, and ephemeral Redis are healthy. The chat gateway is an intentionally inactive opt-in profile; no active WebSocket acceptance claim is carried forward. There are no unfinished migrations; one historical rolled-back ledger row remains. | Web/worker and data services live and verified; chat runtime deferred. |
| Release provenance | The active source directory is an archive deployment, and the private release record binds it to `74ffd3f`, its CI run, migration verification, image identities, and retained rollback release. | Closed for web/worker. |
| Backups and alerts | Daily backup and monitor timers were active and successful during the 2026-07-29 reconciliation; a completed backup was present. | Live and verified. |
| Redis condition | Read-only OVH evidence found low absolute Redis memory use, about 8 MiB allocator/RSS excess per workload, no OOM, eviction, capacity pressure, or organic command errors. | The monitor now requires both a high ratio and more than 16 MiB excess before emitting a fragmentation alert. |
| Worker isolation | The compatibility `worker` is live. The five-service `split-workers` profile is available in source but intentionally not activated. | Deliberately deferred cutover. |
| Image runtime | Minimal compiled images and the Sharp standalone-runtime fix were built by the approved release. | Live and verified. |

## Original-plan reconciliation

The original P1–P3 remediation work exists in source, schema migrations, and
focused tests. The missing distinction is production acceptance evidence.

| Original scope | Current source status | Closure needed |
| --- | --- | --- |
| CHAT-AUTH-001 and CHAT-REDIS-001 | Implemented with security-event revocation, bounded reauthorization, readiness behavior, reconnect recovery, and controlled restart tests. | Exact release provenance is live for the compatible web code; the opt-in gateway is inactive, so beta-account and active-gateway acceptance checks remain separately scheduled operational exercises. |
| Moderation, holds, AI leases, and database-secret hardening | Implemented with committed migrations and focused transaction/recovery tests. | Release and migration provenance are recorded; aggregate-only anomaly queries remain a safe follow-up. |
| WebSocket abuse, read markers, slow mode, presence, blocks, outbox, and retention | Implemented and covered by focused gateway/service tests. | Exact release is proven; non-disruptive aggregate runtime metrics remain an operational follow-up. |
| Redis architecture and worker lifecycle | Two Redis services are live; graceful shutdown and split-worker code are present. | Fragmentation decision is documented and the monitor guard is live; split-worker cutover remains deliberately deferred. |
| Minimal images, CSP, CI gates, and trusted ingress | Source, CI controls, and runbooks are present. | The approved release records image provenance. Public CSP/browser-protection headers are verified; the image-proxy missing-input boundary returns `400` with `no-store`, while successful remote-image transformation remains source/CI verified. The current managed tunnel origin is mapped to the OVH application-host Compose web service, and provider DNS has no web bypass candidate. Three approved forged-header attempts were blocked before the limiter, including one with a one-use Managed-Rules skip, so trusted-header overwrite remains unproven; `NET-001` remains incomplete. |
| AUTH-PERF-001, CHAT-SEQ-001, IMAGE-PROXY-001 | Implemented/decided in `origin/main`; image proxy has re-encoding tests. | Included in the exact live release; no sequence migration is planned without a new design decision. |

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

1. **Completed 2026-07-28.** Review and push the bounded candidate: Sharp
   standalone assets, backup-failure notification wiring, alert presentation,
   reproducible local-gate support, and closure evidence. The alert scripts
   are already installed on OVH; this brings Git history into parity without
   pretending it is an application deployment.
2. **Completed 2026-07-28.** Exact-commit main CI passed for `85f67d5` before
   the approved release.
3. **Completed 2026-07-28.** The approved-release command creates a
   private, non-secret JSON release record with the exact commit, archive
   SHA-256, CI run, backup identifier, migration verification, source-built
   web/worker/chat-gateway image IDs, health results, and retained prior
   release. The `85f67d5` release wrote that record and closed the
   live-provenance gap without placing the record in Git.
4. **Completed 2026-07-28.** The OVH release procedure and capacity were
   rechecked immediately before the staged build.

**Approval boundary:** pushing is not a production deployment. Any future
release requires a fresh typed `DEPLOY <short-sha>` after exact-commit CI is
green.

## Milestone 2 — Approved application release and parity proof

**Status: completed 2026-07-28.**

**Goal:** deploy the candidate once, safely, and prove it matches source.

1. Verified a current PostgreSQL backup, retained rollback release, clean
   source tree, exact candidate SHA, exact CI, OVH capacity, and the staged
   release procedure before mutation.
2. Used the approved release command's staged archive, hash verification,
   migration status, narrow service recreation, and health checks. Stateful
   data services and provider/network settings were not recreated or changed.
3. Recorded source SHA, image identity, migration status, and release time in
   the private release record, closing the provenance gap.
4. Verified canonical health, login, Docker health, gateway readiness, monitor
   result, backup timer, and post-release capacity. CSP/header, image-proxy,
   and aggregate anomaly checks remain non-disruptive follow-ups.

**Done when:** the exact source revision can be tied to the running release
and the relevant P1–P3 acceptance evidence is recorded.

## Milestone 3 — Operational stabilization decisions

**Goal:** finish the items that require an operational choice rather than more
source code.

### 3A. Redis fragmentation

1. **Completed 2026-07-28.** Gather non-mutating memory, allocator, keyspace,
   command-pressure, AOF, and eviction evidence for both Redis workloads.
2. **Completed 2026-07-28.** The high ratios reflect allocator/RSS baseline
   overhead on very small datasets, not workload churn or capacity pressure.
   AOF, policies, health, command pressure, OOM, and eviction signals are
   healthy. Keep direct error and capacity alerts enabled.
3. **Completed 2026-07-28.** The deployed monitor requires both the existing
   ratio threshold and more than 16 MiB fragmented-memory excess before
   emitting a fragmentation alert. No Redis restart, runtime-configuration
   change, or OVH resize was needed for this condition.

### 3B. Split workers

1. **Completed 2026-07-28 (read-only OVH observation).** The compatibility
   worker was healthy, within its resource budget, and had no waiting, active,
   or delayed work across the known queues.
2. **Decision 2026-07-28.** Do not activate `split-workers`. The current
   terminal feed-refresh jobs are backoff-limited upstream-source failures,
   rather than queue backlog, Redis pressure, or worker saturation. Retain the
   all-in-one worker so the five-service profile does not reserve capacity
   without a demonstrated benefit.
3. Reopen this cutover only if sustained backlog, job latency, or resource
   pressure demonstrates an isolation benefit. Any cutover still requires a
   separate explicit approval: stop the compatibility worker before starting
   the five isolated workers; never run both ownership models as steady state.

### 3C. Upstream source health

1. **Observed 2026-07-28 (aggregate-only).** Persistently failing subscribed
   feeds had prior successful refreshes and were scheduled for retry rather
   than overdue. Aggregated error classes were upstream HTTP responses, rate
   limits, and a small number of timeouts; no queue, Redis, or worker defect
   was evidenced.
2. Treat source-level diagnosis and any user-facing failure policy as a
   separate, privacy-aware decision. Do not expose individual feed URLs,
   titles, account data, or raw failure text in logs, public documentation, or
   alert email. A source-health feature needs its own threshold, notification,
   retention, and authorization design before implementation.

**Approval boundary:** either cutover changes production workload ownership and
requires a separate explicit approval.

## Milestone 4 — Close operations evidence

**Goal:** replace stale or duplicate references with current OVH evidence.

1. **Completed 2026-07-28.** Refreshed `current-production-inventory.md` after
   the approved release and marked the exact live state of split workers and
   compiled images.
2. **Completed 2026-07-28.** Updated the remaining public README reference to
   the current production runbook without adding host details to the repository.
3. **Completed 2026-07-30.** Consolidated the original Phase 0 terminology
   into the current inventory, backup/restore checklist, chat-gateway recovery
   guide, deployment rollback runbook, and worker/queue ownership map. The
   current managed-tunnel mapping is recorded separately from the remaining
   `NET-001` runtime-header proof.
4. Revalidate an isolated restore rehearsal before its due date and at least
   quarterly thereafter. Do not reuse or modify historical failed attempts.
5. Keep a short private evidence record for backup freshness, off-host sync,
   alert delivery, monitor state changes, and release provenance.
6. **Updated 2026-07-30 (managed-tunnel recovery and controlled proofs).** The
   current proxied public route uses a managed Cloudflare Tunnel whose healthy
   OVH application-host connector reaches the Compose web service; the
   current origin mapping is therefore complete without recording private
   topology. Two separately approved forged-header image-proxy requests with
   distinct URL forms returned HTTP 403 before reaching the limiter: the
   forged hashed key remained absent and the aggregate anonymous image-proxy
   key count remained zero after each. Keep `NET-001` open solely for a
   future, freshly approved materially different runtime header proof; do not
   retry the blocked request form broadly. A read-only provider Security Events
   view filtered to edge-status 403 classified two of four sampled events as
   `Block` / Managed Rules, but the probes had no retained event identifier;
   that supports edge-side blocking without identifying the trigger or proving
   header overwrite. A later one-use, exact-match Managed-Rules skip was
   deployed for a single third request and deleted immediately after it also
   returned HTTP 403 with unchanged redacted limiter measures; it does not
   identify the remaining edge control or prove header overwrite. This evidence
   is not authorization
   to change DNS, tunnels, firewall, or provider settings.

**Done when:** backup, restore, monitoring, rollback, and deployment facts are
current, reproducible, and OVH-specific.

## Product gate — Arctic Story Intelligence

Do not start product work until Milestones 0–2 are complete and Milestone 3A
has a documented decision. Then start one thin vertical slice only:

1. **PRODUCT-STORY-001A — private full-text search.** Completed in source and
   deployed. It searches only articles readable by the current user, retains
   authorization boundaries, paginates, and has an isolated PostgreSQL
   query-plan gate.
2. **PRODUCT-STORY-001B — saved monitors.** Completed and deployed in the
   `74ffd3f` release. Private named saved searches remain shortcuts to the
   proven filter model and support opt-in scheduled evaluation, pause/resume,
   durable new-match counts, and a mark-seen control. The feature intentionally
   adds no AI, notification, webhook, reader automation, or historical
   backfill.

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

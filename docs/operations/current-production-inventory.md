# Current production inventory

**Captured:** 2026-07-29
**Updated:** 2026-07-30, after managed-tunnel reconciliation.
**Scope:** non-secret reconciliation after the approved `74ffd3f` release.

This document intentionally excludes host addresses, account names, release
paths, tunnel identifiers, environment values, and backup locations. Keep
those details in the private operator inventory.

> The web and compatibility-worker images are running the approved
> `74ffd3f` release. Durable and ephemeral Redis are healthy, and the
> compatibility worker remains intentionally active. The opt-in chat gateway
> is deliberately **not running**; do not describe its real-time path as
> live-verified until it is separately activated and tested. The split-worker
> profile remains deferred until sustained workload evidence justifies a
> separately approved cutover.

## Verified runtime state

- The Compose project runs `web`, `worker`, `chat-gateway`, `postgres`,
  durable `redis`, disposable `redis-ephemeral`, and the one-shot `migrate`
  service.
- PostgreSQL and both Redis services are loopback-bound. Durable Redis has
  append-only persistence, a deliberate memory ceiling, and a `noeviction`
  policy so queue jobs are not silently discarded. Ephemeral Redis has no
  volume and uses the separate short-lived-state policy.
- PostgreSQL, durable Redis, ephemeral Redis, web, and the compatibility
  worker report healthy Docker status. The worker updates an internal
  heartbeat file for its health check.
- The existing chat-gateway container is cleanly stopped rather than failed or
  OOM-killed. Its release record is `not-running`, which is the expected
  result for the opt-in profile; the release procedure did not implicitly
  activate it.
- Stateless containers use read-only filesystems, restricted temporary storage,
  dropped Linux capabilities, no-new-privileges, bounded CPU/memory/process
  limits, and bounded local Docker logs. Stateful services retain only the
  write access and durable volumes they require.
- `/api/live` returns `200` only on loopback. `/api/health` returns a minimal
  `200 {"status":"ok"}` when PostgreSQL and Redis are ready, and public
  requests to `/api/live` return `404`.
- The canonical public health endpoint and login surface returned HTTP 200
  during this capture. HTTPS response protections include strict transport,
  clickjacking, MIME-sniffing, referrer, and browser-permissions controls.
- Four application/data listeners were present and all were loopback-bound;
  no public listener was observed for ports 3000, 3001, 5432, 6379, or 6380.
  The host firewall was active. The current managed-tunnel origin is mapped to
  this application's Compose web service without recording private topology.
  [trusted-ingress-verification.md](trusted-ingress-verification.md) retains
  the separate, still-open runtime proof for `CF-Connecting-IP` overwrite.
- The production database has no unfinished Prisma migrations. One historical
  rolled-back migration record remains in the ledger, while the approved
  release record reports 32 applied migrations; it is not an active migration
  failure. The release procedure validates a custom-format backup with
  `pg_restore -l` before each swap and retains the prior release directory for
  rollback.
- The private release record ties the live archive deployment to public commit
  `74ffd3f`, its successful CI run, migration verification, source-built web
  and worker image tags, and public health/login checks. The record itself
  remains outside Git.
- Runtime and migration database accounts are separate, login-capable,
  non-superuser roles with no role-management or database-creation powers.
- Database-level integrity guards prevent cross-user folder links, malformed
  collection items, and case-only duplicate account emails; the matching folder
  deletion operation is transactional. Administrator audit records retain an
  immutable actor snapshot and survive actor-account deletion.

## Verified host and recovery controls

- The host has current operating-system security updates, synchronized time,
  automatic security updates, and an active intrusion-ban service.
- Root and password SSH sign-in are disabled. SSH accepts only the explicitly
  allowed administrator account, while the firewall defaults to denying inbound
  traffic and permits only remote administration. Application and data-service
  ports remain loopback-only.
- The database uses verified backups and Redis append-only persistence with a
  deliberate memory ceiling and no-eviction policy. The application monitor
  checks backup freshness, service health, data-store persistence, disk space,
  readiness, and certificate expiry.
- The backup and monitor timers were active and their latest service results
  were successful during this capture. A current completed backup was present.
  Alert routing and the private off-host backup copy remain outside this
  repository.
- A private Windows scheduled task copies the newest VPS backup to off-host
  storage, validates both database-file checksums, and retains 30 days of
  local copies. The latest manual synchronization and a disposable restore
  drill both completed successfully on 2026-07-13.

## Delivery and verification controls

- Production source is deployed from an archive of a reviewed commit rather
  than from a live Git checkout.
- The existing `.env` is copied into the staged release without displaying it
  and retains owner-only permissions.
- GitHub CI runs Prisma generation, `migrate deploy`, migration status and
  drift checks against PostgreSQL, then tests, type checking, linting, and the
  production build.
- Transactional email uses bounded connection, greeting, socket, and total-send
deadlines. A small SMTP connection pool is reused for matching configuration.

## Verified REDIS-ARCH-001 live topology

- `redis` remains the durable queue service: AOF is enabled, `noeviction`
  protects BullMQ data, and only this service has a Redis volume.
- `redis-ephemeral` has no volume and serves Socket.IO pub/sub, chat presence,
  connection-token replay protection, rate limits, and security-event fan-out.
  It uses a separate memory ceiling and `volatile-ttl` policy.
- Queue producers, workers, queue inspection, and schedulers use
  `DURABLE_REDIS_URL`; rate limits and all chat gateway/event Redis clients use
  `EPHEMERAL_REDIS_URL`. The checked-in configuration rejects `REDIS_URL`
  fallback and matching normalized workload endpoints unless the explicit
  temporary migration flag is set; remove the flag and legacy URL before Phase
  5 begins. This source change is not deployment evidence.
- The release procedure starts durable Redis, then ephemeral Redis. It
  recreates the chat gateway only when that opt-in profile was already running,
  and finally recreates web/worker containers. The monitor verifies each
  running service health check, AOF where required, policy, error/OOM
  counters, and fragmentation without printing secrets.
- WORKER-ARCH-001 intentionally keeps the all-in-one worker as the live
  default while offering an opt-in `split-workers` profile for ingestion,
  AI/mail, imports, maintenance, and chat events. Each split service has an
  isolated heartbeat and resource limit; the maintenance scheduler owns a
  durable Redis lease so duplicate scheduler instances skip rather than
  overlap. Do not activate both ownership models together.

## Verified IMAGE-001 runtime state

- The worker and chat gateway are compiled to compact Node 24 ESM bundles at
  build time. The approved release built and runs the resulting minimal images,
  including the standalone native-image assets required at runtime. Their final
  images copy only compiled output and pruned production dependencies: no
  source tree, tests, documentation, TypeScript compiler, or `tsx` runtime is
  retained.
- Node, PostgreSQL, and Redis base tags are pinned to reviewed versioned
  Alpine variants. Existing non-root users, read-only filesystems, dropped
  capabilities, no-new-privileges policy, and health checks remain in force.
- CI records byte-accurate image sizes with separate SBOMs, and the private
  release record retains the source-built image identities for rollback.

## Remaining operator follow-ups

- Maintain the 30-day off-host backup retention and run the documented restore
  drill at least quarterly and after backup-format changes.
- Keep `NET-001` open only for its runtime `CF-Connecting-IP` overwrite proof.
  The current managed-tunnel-to-Compose mapping and no-bypass DNS inventory
  are already recorded; do not retry the blocked request form or alter ingress
  without a new approved proof design.
- Keep the chat gateway inactive until an explicitly approved beta activation
  and controlled WebSocket acceptance test are scheduled. CHAT-AUTH-001 and
  CHAT-REDIS-001 remain source- and CI-verified, not active-runtime verified.
- Keep provider snapshots and SSH/firewall recovery procedures in the private
  operator inventory.
- Monitor queue backlog and failed email delivery in the application admin
  surfaces. Host disk, inode, backup freshness, Redis persistence, container
  health, internal and public readiness, and HTTPS certificate expiry are
  covered by the production monitor service. Include both Redis workloads'
  policy and pressure alerts in that review.
- Periodically review managed-edge firewall, rate-limit, and access policies in
  the provider dashboard; those provider-side settings are intentionally not
  stored in this repository.
- Review the repository history before any public release; removing sensitive
  text from current files does not erase historical commits.

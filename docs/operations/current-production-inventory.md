# Current production inventory

**Captured:** 2026-07-29
**Updated:** 2026-08-10, after the verified `c04e509` fifth-pass release.
**Scope:** non-secret current-state addendum plus the historical `74ffd3f`
reconciliation snapshot below.

This document intentionally excludes host addresses, account names, release
paths, tunnel identifiers, environment values, and backup locations. Keep
those details in the private operator inventory.

## 2026-08-10 current-release addendum

`c04e509` is the current verified website release, deployed through the
approved controller with the `all-in-one-with-chat` topology. The controller
recorded fresh private backup evidence, verified migration status, retained the
previous release for rollback, and passed selected-service, loopback, public
health/login, and monitor gates.

The first `c04e509` controller attempt stopped before remote mutation at its
capacity preflight. The separately approved repair removed only stale,
unreferenced old release-image tags and explicitly preserved the live and
rollback image sets; it did not remove backups, volumes, release sources, or
journals. Independent verification then confirmed the deployed revision,
healthy PostgreSQL, durable Redis, ephemeral Redis, web, worker,
worker-health, chat gateway, and edge proxy; loopback health/liveness; public
health and login HTTP 200; and an active-successful monitor. Roughly 7.4 GiB
of root capacity was available after the successful release. The older snapshot
below remains historical evidence only where it names `74ffd3f`, 32 migrations,
or an inactive chat gateway.

> The current release is `c04e509`. The all-in-one worker and active chat
> gateway are part of the verified topology. The split-worker profile remains
> deferred until sustained workload evidence justifies a separately approved
> cutover.

## Verified runtime state

- The Compose project runs `web`, `worker`, `worker-health`, `chat-gateway`,
  `edge-proxy`, `postgres`, durable `redis`, and disposable `redis-ephemeral`;
  the one-shot `migrate` service is used by the release controller.
- PostgreSQL and both Redis services are loopback-bound. Durable Redis has
  append-only persistence, a deliberate memory ceiling, and a `noeviction`
  policy so queue jobs are not silently discarded. Ephemeral Redis has no
  volume and uses the separate short-lived-state policy.
- PostgreSQL, durable Redis, ephemeral Redis, web, worker, worker-health,
  chat gateway, and edge proxy report healthy Docker status. The workers update
  internal heartbeat files for their health checks.
- The chat gateway and edge proxy are active only because the selected
  `all-in-one-with-chat` topology explicitly includes them; their canonical
  browser path remains behind the managed tunnel.
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
  rolled-back migration record remains in the ledger; it is not an active
  migration failure. The release procedure validates a custom-format backup with
  `pg_restore -l` before each swap and retains the prior release directory for
  rollback.
- The private release record ties the live archive deployment to public commit
  `c04e509`, its successful CI run, migration verification, source-built image
  tags, and public health/login checks. The record itself
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
- The fourth-pass source pins Node, nginx, PostgreSQL, durable Redis,
  ephemeral Redis, Cloudflared, and the restore-drill PostgreSQL image to a
  reviewed version plus immutable manifest digest. This is source and CI
  evidence, not a claim that the currently running OVH release has changed.
  See [container-image-update-policy.md](container-image-update-policy.md).
  Existing non-root users, read-only filesystems, dropped capabilities,
  no-new-privileges policy, and health checks remain in force.
- CI records byte-accurate image sizes with separate SBOMs, and the private
  release record retains the source-built image identities for rollback.

## Remaining operator follow-ups

- Maintain the 30-day off-host backup retention and run the documented restore
  drill at least quarterly and after backup-format changes.
- Review the root-capacity trend before every release. The approved controller
  remains the exact archive-aware capacity gate; the monitor's byte reserve and
  rollback-safe release-image retention are source safeguards pending their own
  later approved deployment. Named recovery archives require an explicit review
  deadline and are never automatically deleted by that safeguard.
- Keep `NET-001` open only for its runtime `CF-Connecting-IP` overwrite proof.
  The current managed-tunnel-to-Compose mapping and no-bypass DNS inventory
  are already recorded; do not retry the blocked request form or alter ingress
  without a new approved proof design.
- The chat gateway is active as part of the verified `all-in-one-with-chat`
  release. Schedule a controlled user-facing WebSocket acceptance test before
  claiming its authenticated real-time flows are independently verified.
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

# Current production inventory

**Captured:** 2026-07-26
**Scope:** non-secret verification after the latest reviewed release.

This document intentionally excludes host addresses, account names, release
paths, tunnel identifiers, environment values, and backup locations. Keep
those details in the private operator inventory.

> Durable and ephemeral Redis are verified live as of 2026-07-26. The
> reviewed worker-isolation and compiled-image changes below remain source
> targets until their own exact-commit release gates are approved.

## Verified runtime state

- The Compose project runs `web`, `worker`, `postgres`, durable `redis`,
  disposable `redis-ephemeral`, and the one-shot `migrate` service.
- PostgreSQL and both Redis services are loopback-bound. Durable Redis has
  append-only persistence, a deliberate memory ceiling, and a `noeviction`
  policy so queue jobs are not silently discarded. Ephemeral Redis has no
  volume and uses the separate short-lived-state policy.
- The web process and the worker run as unprivileged users. Both report healthy
  Docker status; the worker updates an internal heartbeat file for its health
  check.
- Stateless containers use read-only filesystems, restricted temporary storage,
  dropped Linux capabilities, no-new-privileges, bounded CPU/memory/process
  limits, and bounded local Docker logs. Stateful services retain only the
  write access and durable volumes they require.
- `/api/live` returns `200` only on loopback. `/api/health` returns a minimal
  `200 {"status":"ok"}` when PostgreSQL and Redis are ready, and public
  requests to `/api/live` return `404`.
- The public edge redirects HTTP to HTTPS and serves the application through
  the managed tunnel. HTTPS response protections include strict transport,
  clickjacking, MIME-sniffing, referrer, and browser-permissions controls.
- The production database has committed Prisma migrations applied. The release
  procedure validates a custom-format backup with `pg_restore -l` before each
  swap and retains the prior release directory for rollback.
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

## Reviewed REDIS-ARCH-001 target state

- `redis` remains the durable queue service: AOF is enabled, `noeviction`
  protects BullMQ data, and only this service has a Redis volume.
- `redis-ephemeral` has no volume and serves Socket.IO pub/sub, chat presence,
  connection-token replay protection, rate limits, and security-event fan-out.
  It uses a separate memory ceiling and `volatile-ttl` policy.
- Queue producers, workers, queue inspection, and schedulers use
  `DURABLE_REDIS_URL`; rate limits and all chat gateway/event Redis clients use
  `EPHEMERAL_REDIS_URL`. `REDIS_URL` remains a compatibility fallback only for
  a staged one-Redis rollout.
- The deployment command starts durable Redis, then ephemeral Redis, then an
  active chat gateway, and finally web/worker containers. The monitor verifies
  each health check, AOF where required, policy, error/OOM counters, and
  fragmentation without printing secrets.
- The reviewed WORKER-ARCH-001 target keeps the all-in-one worker as a safe
  default while offering an opt-in `split-workers` profile for ingestion,
  AI/mail, imports, maintenance, and chat events. Each split service has an
  isolated heartbeat and resource limit; the maintenance scheduler owns a
  durable Redis lease so duplicate scheduler instances skip rather than
  overlap.

## Reviewed IMAGE-001 target state

- The worker and chat gateway are compiled to compact Node 24 ESM bundles at
  build time. Their final images copy only those bundles and pruned production
  dependencies: no source tree, tests, documentation, TypeScript compiler, or
  `tsx` runtime is retained.
- Node, PostgreSQL, and Redis base tags are pinned to reviewed versioned
  Alpine variants. Existing non-root users, read-only filesystems, dropped
  capabilities, no-new-privileges policy, and health checks remain in force.
- CI records byte-accurate image sizes with separate SBOMs, so the approved
  rollout can compare the compiled images against the previous image set.

## Remaining operator follow-ups

- Maintain the 30-day off-host backup retention and run the documented restore
  drill at least quarterly and after backup-format changes.
- Keep provider snapshots and SSH/firewall recovery procedures in the private
  operator inventory.
- Monitor queue backlog and failed email delivery in the application admin
  surfaces. Host disk, inode, backup freshness, Redis persistence, container
  health, internal and public readiness, and HTTPS certificate expiry are
  covered by the production monitor service. After REDIS-ARCH-001 is deployed,
  include both Redis workloads' policy and pressure alerts in that review.
- Periodically review managed-edge firewall, rate-limit, and access policies in
  the provider dashboard; those provider-side settings are intentionally not
  stored in this repository.
- Review the repository history before any public release; removing sensitive
  text from current files does not erase historical commits.

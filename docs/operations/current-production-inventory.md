# Current production inventory

**Captured:** 2026-07-13
**Scope:** non-secret verification after the latest reviewed release.

This document intentionally excludes host addresses, account names, release
paths, tunnel identifiers, environment values, and backup locations. Keep
those details in the private operator inventory.

## Verified runtime state

- The Compose project runs `web`, `worker`, `postgres`, `redis`, and the
  one-shot `migrate` service.
- PostgreSQL and Redis are loopback-bound. Redis has append-only persistence,
  a deliberate memory ceiling, and a `noeviction` policy so queue jobs are not
  silently discarded.
- The web process and the worker run as unprivileged users. Both report healthy
  Docker status; the worker updates an internal heartbeat file for its health
  check.
- `/api/live` returns `200` only on loopback. `/api/health` returns a minimal
  `200 {"status":"ok"}` when PostgreSQL and Redis are ready, and public
  requests to `/api/live` return `404`.
- The production database has committed Prisma migrations applied. The release
  procedure validates a custom-format backup with `pg_restore -l` before each
  swap and retains the prior release directory for rollback.

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

## Remaining operator follow-ups

- Maintain encrypted, off-host backup retention and run the documented
  restore drill at least quarterly and after backup-format changes.
- Keep provider snapshots and SSH/firewall recovery procedures in the private
  operator inventory.
- Monitor queue backlog and failed email delivery in the application admin
  surfaces. Host disk, inode, backup freshness, Redis persistence, container
  health, internal and public readiness, and HTTPS certificate expiry are
  covered by the production monitor service.
- Review the repository history before any public release; removing sensitive
  text from current files does not erase historical commits.

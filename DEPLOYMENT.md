# Arctic RSS deployment and recovery

This guide is intentionally generic. Keep the real host address, SSH key,
release path, tunnel configuration, backup location, and `.env` values in a
private operator inventory outside this repository.

## Runtime model

The production Compose project contains `web`, `worker`, `postgres`, `redis`,
and a one-shot `migrate` service. Public traffic reaches the loopback-bound web
service through a separately managed Cloudflare connector. PostgreSQL and Redis
must not be published to the Internet.

The application has two health boundaries:

- `GET /api/live` is a loopback-only liveness probe. It confirms the web
  process can answer a request and is used by Docker health checks.
- `GET /api/health` is a minimal public-safe readiness probe. It performs
  deadline-bound checks of PostgreSQL and Redis and returns only `ok` or
  `degraded`.

## Environment

Copy `.env.example` to the production host and set the required values without
printing them. The file must be owned by the deployment account and mode 0600.
It must never be committed, copied to a workstation, included in release
archives, or pasted into tickets.

Use distinct PostgreSQL credentials for `DATABASE_URL` and
`MIGRATE_DATABASE_URL`: the runtime account needs only normal application data
access, while the migration account owns the schema and is used solely by the
one-shot `migrate` service. Do not use the PostgreSQL superuser connection for
either application runtime service.

Set `REDIS_PASSWORD` to a separate high-entropy value, then include that value
in `REDIS_URL`. Redis is an internal dependency, but its password still
protects the job queue and rate-limit data if another local service is
compromised.

For transactional email, configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`,
`SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`. Optional safety controls are
`SMTP_CONNECTION_TIMEOUT_MS`, `SMTP_GREETING_TIMEOUT_MS`,
`SMTP_SOCKET_TIMEOUT_MS`, `SMTP_SEND_TIMEOUT_MS`, and
`SMTP_POOL_MAX_CONNECTIONS`.

## Safe release procedure

Before every production change:

1. Confirm a recovery console is available.
2. Record the reviewed commit and archive checksum.
3. Run the verified PostgreSQL backup job. It must include the custom-format
   database archive and the protected role-definition export, with checksums
   verified before deployment.
4. Stage the archive beside the active release and copy the existing `.env`
   into it with mode 0600.
5. Run `docker compose config -q` in the staged release.
6. Build `web`, `worker`, and `migrate`, then run the one-shot `migrate`
   service before the release swap.
7. Move the old release aside as the rollback candidate, activate the staged
   release, and recreate only `web` and `worker`.
8. Verify Docker health, internal `/api/live`, internal `/api/health`, public
   `/api/health`, `/login`, and the changed user flow.

When piping a multi-line script over SSH from Windows, preserve LF line endings
and redirect each `docker compose exec` or `run` command from `/dev/null` so it
cannot consume the rest of the deployment script.

## Schema changes

Production uses committed Prisma migrations only:

```bash
npx prisma migrate deploy
npx prisma migrate status
```

Never use `prisma db push` in production. For risky changes use an
expand/contract rollout: add compatible fields first, deploy dual-read/write
code, backfill in bounded batches, switch reads, then remove old fields in a
later release.

## Rollback

1. Keep the failed release, logs, and matching backup for diagnosis.
2. Restore the previous release directory and recreate `web` and `worker`.
3. If the failed release changed the schema, do not roll code backward across
   an incompatible schema. Restore the matching database backup or use a
   reviewed forward repair.
4. Verify internal liveness/readiness, public readiness, login, and the
   affected user flow before declaring recovery complete.

## Supporting runbooks

- [Deployment and rollback](docs/operations/deployment-rollback-runbook.md)
- [Backup and restore checklist](docs/operations/backup-restore-checklist.md)
- [Migration baseline](docs/operations/migration-baseline-runbook.md)
- [Canonical origin and proxy](docs/operations/canonical-origin-proxy-runbook.md)

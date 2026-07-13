# Production deployment and rollback runbook

This is the safety gate for Arctic RSS on the current single-VPS topology. It
does not authorize a production change by itself. The backup checklist and a
reviewed target commit are mandatory first.

## Current deployment constraints

- The active deployment is Docker Compose with web, worker, PostgreSQL, Redis,
  and a one-shot migration service.
- Public traffic reaches the loopback-bound web service through a separately
  managed Cloudflare connector.
- The deployed source directory is not a Git checkout, so use a reviewed source
  archive or a deliberately introduced commit-addressable release process.
- The migration service uses `prisma migrate deploy`; schema changes must be
  committed, reviewed Prisma migrations.

## Pre-deployment checklist

1. Complete [backup-restore-checklist.md](backup-restore-checklist.md).
2. Record the source commit, archive checksum, container image IDs, and active
   release directory.
3. Confirm production `.env` is present, mode 0600, and will be copied into the
   new release without printing it.
4. Confirm a recovery console is available and the previous release is intact.
5. Confirm the change is schema-compatible. If a migration is required, it
   must be a committed, reviewed Prisma migration with an expand/contract plan.

## Code-only deployment pattern

Use a clean archive excluding `.env`, `.git`, `node_modules`, `.next`, `tmp`,
`out`, `coverage`, generated Prisma output, TypeScript build info, and OPML
imports. Upload it to a staging directory beside the active release.

1. Unpack to a new release directory.
2. Copy the existing production `.env` into that directory without displaying
   its contents.
3. Retain the old app directory as the rollback candidate.
4. Switch the release directory into the active app path.
5. Run the Compose rebuild as a separate plain SSH command to avoid
   PowerShell/CRLF argument corruption:

   ```bash
   cd "$APP_DIR"
   docker compose up --build -d
   ```

6. Verify:

   ```bash
   docker compose ps
   curl -fsS http://127.0.0.1:3000/api/health
   ```

7. Verify the public health endpoint, login page, and the changed user flow.

## Schema-changing deployment pattern

Use this pattern only after a fresh backup/snapshot gate and after reviewing
the migration SQL. Do not use `prisma db push` in production.

1. Build the reviewed release.
2. Run the one-off migration service and verify its status before replacing
   web or worker:

   ```bash
   cd "$APP_DIR"
   docker compose run --rm --no-deps migrate
   docker compose run --rm --no-deps worker npx prisma migrate status
   ```

3. Recreate web, then worker, and run the normal health and smoke tests.
4. For a risky change, use expand/contract: add nullable fields first,
   deploy dual-read/write code, backfill in bounded batches, then remove old
   fields in a later release.

The initial baseline migration is recorded with `prisma migrate resolve
--applied` only after a read-only schema diff proves that production already
matches it. It must never be executed as CREATE TABLE SQL against production.

## SEC-001 administrator-role remediation

This release has no schema change. Do not invoke `prisma db push` as part of
this deployment. The current Compose stack normally runs a one-shot migration
service, so rebuild and recreate only the application services after the
backup gate is complete:

```bash
cd "$APP_DIR"
docker compose build web worker
docker compose up -d --no-deps --force-recreate web worker
docker compose ps
curl -fsS http://127.0.0.1:3000/api/health
```

Before starting the new containers, make these secret-safe edits in the
production `.env` without printing it:

1. Set `REQUIRE_EMAIL_VERIFICATION=true` (or remove it to use the safe
   default).
2. Remove `ADMIN_EMAILS` entirely; the release refuses to start while it is
   present in production.
3. Confirm the known recovery administrator is active and email-verified.

Existing administrator roles are intentionally preserved. Only if a deliberate
role change is required, promote a known active, verified account from the
server after the web and worker health checks pass:

```bash
docker compose run --rm --no-deps worker \
  npm run admin:bootstrap -- --email admin@example.com
```

Verify that public signup creates a standard user, an unverified account cannot
sign in, the known administrator can reach `/admin`, and the promotion command
is idempotent. If the application fails to start because the safe environment
values were not applied, correct those values rather than weakening the check.

## SEC-002 session-revocation deployment

This release has the additive `authVersion` migration. It deliberately
invalidates every old cookie that lacks this field. After the backup gate,
apply the migration, rebuild web and worker, and verify the migration is
current before checking the login and administrator flows:

```bash
cd "$APP_DIR"
docker compose run --rm --no-deps migrate
docker compose build web worker
docker compose up -d --no-deps --force-recreate web worker
docker compose run --rm --no-deps worker npx prisma migrate status
curl -fsS http://127.0.0.1:3000/api/health
```

Do not rotate `AUTH_SECRET` as an incidental deployment step. See
[session-revocation-runbook.md](session-revocation-runbook.md) for the
administrator control, verification steps, and the security implication of a
code rollback.

## Rollback

1. Keep the currently running failed release and its logs for diagnosis.
2. Restore the prior app directory or prior known-good image.
3. Rebuild only the restored release:

   ```bash
   cd "$APP_DIR"
   docker compose up --build -d
   docker compose ps
   curl -fsS http://127.0.0.1:3000/api/health
   ```

4. If the release included a schema change, do not roll application code back
   across an incompatible schema. Restore the matching database backup or use a
   reviewed forward repair.
5. Validate the public health endpoint and the affected authentication/reader
   flow before declaring rollback complete.

## Required completion evidence

- Target commit/archive checksum and deploy time.
- Backup/snapshot identifiers and restore verification.
- Container status and local/public health results.
- Smoke-test results for the changed behavior.
- Rollback target and whether it was retained.

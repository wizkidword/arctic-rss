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
- The migration service has its own Docker image. Rebuild that image from the
  staged release immediately before running it; `docker compose run migrate`
  alone may reuse an older image that cannot see a newly committed migration.
- In shell examples, replace `CANONICAL_HOST` with the reviewed public host
  name. Do not read it by printing the production `.env`.

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
3. Validate the staged Compose file, then build `web`, `worker`, and `migrate`
   from that exact staged directory. Run the one-shot migration service only
   after its build completes. `migrate deploy` is safe when no migration is
   pending.
4. Retain the old app directory as the rollback candidate, then switch the
   staged directory into the active app path.
5. Recreate web and worker without rebuilding unrelated data services:

   ```bash
   cd "$APP_DIR"
   docker compose up -d --no-deps --force-recreate web worker
   ```

6. Verify liveness before readiness:

   ```bash
   docker compose ps
   curl -fsS -H 'Host: CANONICAL_HOST' http://127.0.0.1:3000/api/live
   curl -fsS -H 'Host: CANONICAL_HOST' http://127.0.0.1:3000/api/health
   ```

7. Verify the public health endpoint, login page, and the changed user flow.

## Schema-changing deployment pattern

Use this pattern only after a fresh backup/snapshot gate and after reviewing
the migration SQL. Do not use `prisma db push` in production.

1. Build the reviewed release, including the migration image.
2. Run the one-off migration service and verify its status before replacing
   web or worker. Run the status command through the freshly built `migrate`
   image as well:

   ```bash
   cd "$APP_DIR"
   docker compose build migrate
   docker compose run --rm --no-deps migrate
   docker compose run --rm --no-deps migrate npx prisma migrate status
   ```

   The deploy output must list the reviewed new migration when one is expected.
   If it instead reports an older migration count or "up to date", stop the
   release and rebuild `migrate` from the staged directory; do not switch web
   or worker to code that depends on an unapplied schema change.

3. Recreate web and worker, then run the normal liveness, readiness, and smoke
   tests.
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
curl -fsS -H 'Host: CANONICAL_HOST' http://127.0.0.1:3000/api/health
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
curl -fsS -H 'Host: CANONICAL_HOST' http://127.0.0.1:3000/api/health
```

Do not rotate `AUTH_SECRET` as an incidental deployment step. See
[session-revocation-runbook.md](session-revocation-runbook.md) for the
administrator control, verification steps, and the security implication of a
code rollback.

## SEC-004 canonical-origin and trusted-proxy deployment

This release has no schema change. It requires one secret-safe edit to the
production `.env` before starting the new web or worker image:

1. Set `APP_ORIGIN` to the reviewed canonical HTTPS public origin.
2. Confirm `AUTH_URL` matches it exactly without printing either value.
3. Leave `APP_ALLOWED_HOSTS` blank unless a reviewed Cloudflare public-hostname
   alias must redirect to the canonical origin.
4. Do not rely on `X-Forwarded-Host`, `X-Forwarded-Proto`, or `CF-Visitor` for
   app redirects. Cloudflare is responsible for the external HTTP-to-HTTPS
   redirect; the app validates the direct Host value it receives.

Keep the existing `AUTH_URL` because Auth.js uses it to pin authentication
request URLs. Legacy `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL`, if still
present, must match `APP_ORIGIN`; otherwise startup intentionally fails.

After the normal source swap and rebuild, verify the local Docker liveness
probe, local readiness, public health, login, and these local header probes
from the VPS:

```bash
curl -fsS -H 'Host: CANONICAL_HOST' http://127.0.0.1:3000/api/live
curl -fsS -H 'Host: CANONICAL_HOST' http://127.0.0.1:3000/api/health
curl -sS -o /dev/null -D - \
  -H 'Host: invalid.example' \
  http://127.0.0.1:3000/login | head
curl -sS -o /dev/null -D - \
  -H 'Host: CANONICAL_HOST' \
  -H 'X-Forwarded-Host: invalid.example' \
  -H 'X-Forwarded-Proto: http' \
  http://127.0.0.1:3000/login | head
```

The first login probe must return `400`; the second must not contain a
redirect to `invalid.example`. Replace `CANONICAL_HOST` only after checking the
reviewed public origin. Do not paste the production `.env` into a shell or
ticket.

## SEC-005 rate limiting and Turnstile deployment

This release has no schema change. It adds Redis-backed protected-action limits
and a 256 MB Redis ceiling with `noeviction`, so queued worker jobs cannot be
evicted by limiter keys. Check current Redis memory before deployment with the
safe commands in [rate-limit-turnstile-runbook.md](rate-limit-turnstile-runbook.md).

Turnstile remains optional until the Cloudflare widget keys are configured. Do
not set `TURNSTILE_REQUIRED=true` until both keys have been placed in the VPS
`.env`; otherwise the secure production configuration intentionally stops the
web service at startup. Follow the secret-safe configuration steps in the
rate-limit and Turnstile runbook, then smoke-test login, signup, and password
reset with a real challenge.

## Rollback

1. Keep the currently running failed release and its logs for diagnosis.
2. Restore the prior app directory or prior known-good image.
3. Recreate only the restored application services:

   ```bash
   cd "$APP_DIR"
   docker compose up -d --no-deps --force-recreate web worker
   docker compose ps
   curl -fsS -H 'Host: CANONICAL_HOST' http://127.0.0.1:3000/api/live
   curl -fsS -H 'Host: CANONICAL_HOST' http://127.0.0.1:3000/api/health
   ```

4. If the release included a schema change, do not roll application code back
   across an incompatible schema. Restore the matching database backup or use a
   reviewed forward repair.
5. Validate the public health endpoint and the affected authentication/reader
   flow before declaring rollback complete.

## Required completion evidence

- Target commit/archive checksum and deploy time.
- Backup/snapshot identifiers and restore verification.
- Container status and local/public health results. Local checks must send the reviewed canonical Host header; a bare loopback Host is intentionally rejected.
- Smoke-test results for the changed behavior.
- Rollback target and whether it was retained.

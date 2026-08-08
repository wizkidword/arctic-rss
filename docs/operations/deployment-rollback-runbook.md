# Production deployment and rollback runbook

This is the safety gate for Arctic RSS on the current single-VPS topology. It
does not authorize a production change by itself. The backup checklist and a
reviewed target commit are mandatory first.

## Current deployment constraints

- The active deployment is Docker Compose with web, PostgreSQL, durable Redis,
  ephemeral Redis, a one-shot migration service, and exactly one selected
  worker topology. See [deployment-topologies.md](deployment-topologies.md)
  for the authoritative profile and service list.
- Public traffic reaches the loopback-bound web service through a separately
  managed Cloudflare connector.
- The deployed source directory is not a Git checkout, so use a reviewed source
  archive or a deliberately introduced commit-addressable release process.
- The migration service uses `prisma migrate deploy`; schema changes must be
  committed, reviewed Prisma migrations.
- Before the migration service runs, the approved release script compares the
  staged migration names with the current release and runs the dependency-free
  migration-risk classifier for every new migration. A flagged migration must
  have a complete record under
  [`migration-risk`](migration-risk) before Prisma is allowed to start. This
  is an owner-decision gate, not an automatic approval.
- The migration service has its own Docker image. Rebuild that image from the
  staged release immediately before running it; `docker compose run migrate`
  alone may reuse an older image that cannot see a newly committed migration.
- In shell examples, replace `CANONICAL_HOST` with the reviewed public host
  name. Do not read it by printing the production `.env`.

## Migration risk procedure

Run the same changed-migration classifier locally or in CI with the reviewed
comparison base:

```bash
npm run migration:risk -- --base REVIEWED_BASE_SHA
```

The classifier deliberately produces conservative prompts for stored generated
columns, type changes, destructive drops, non-concurrent indexes, unbounded
data changes, direct non-null additions, unstaged foreign keys, and enum
replacement. A safe result means no recognized high-risk pattern was found; it
does not prove the SQL is safe for a material production table.

For each flagged migration, create
`docs/operations/migration-risk/<migration-name>.md` with all required fields:
migration name, author/date, affected tables, row and size estimates, lock and
rewrite risk, duration, online strategy, backfill and validation plans,
maintenance decision, rollback and forward recovery, backup evidence, owner
approval, and production result.

Use expand-and-contract for material data changes: expand the schema, backfill
bounded resumable batches outside the schema transaction, create or validate
indexes and constraints through a controlled online-safe path, switch the
application, then contract only after evidence. `CREATE INDEX CONCURRENTLY`
cannot run inside Prisma's normal transaction; do not manually mark it applied
until its SQL result, schema/index validity, compatible application version,
and Prisma history are all verified.

## REDIS-ARCH-001 durable/ephemeral Redis deployment

This change adds a second, internal-only Redis container. It has no schema
change, but it does change the runtime topology. Do not run it until the
normal backup gate and a typed deployment approval have been recorded.

1. Preserve the existing `redis-data` volume and do not create a backup policy
   for `redis-ephemeral`: only the durable Redis has recoverable state.
2. Without printing values, add `DURABLE_REDIS_URL` and
   `EPHEMERAL_REDIS_URL` to the root-only production `.env`. Both URLs must
   use the existing `REDIS_PASSWORD`; they target `redis` and
   `redis-ephemeral` respectively. `REDIS_URL` is deprecated; production
   requires those workload-specific values and rejects a shared target unless
   `ARCTIC_RSS_ALLOW_LEGACY_REDIS_URL_FOR_MIGRATION=true` is a reviewed,
   temporary migration exception. Remove that exception and `REDIS_URL` before
   Phase 5 begins.
3. Confirm the new keys exist, render the staged Compose file, then start the
   data services in order. Do not start the application containers until both
   Redis health checks pass:

   ```bash
   cd "$APP_DIR"
   for key in DURABLE_REDIS_URL EPHEMERAL_REDIS_URL; do
     grep -q "^${key}=." .env || {
       echo "missing required Redis migration key: ${key}" >&2
       exit 1
     }
   done
   docker compose config -q
   docker compose up -d --no-deps --force-recreate redis redis-ephemeral
   docker compose ps redis redis-ephemeral
   ```

4. If the opt-in chat gateway is active, recreate it next. Then recreate web
   and every application service in the selected topology. Verify local/public health and the monitor service. Use the
   Redis checks in [rate-limit-turnstile-runbook.md](rate-limit-turnstile-runbook.md)
   to confirm AOF/`noeviction` on durable Redis and no AOF/`volatile-ttl` on
   ephemeral Redis.
5. Verify queue backlogs from the administrator surface and exercise a
   non-production rate-limit flow. Do not treat a healthy ephemeral container
   as proof that queue persistence works; only durable Redis may carry BullMQ
   jobs.

To roll back the application release, retain the durable volume and the
previous `.env`. It is safe to stop and recreate `redis-ephemeral`; never
delete `redis-data` as part of a code rollback.

## WORKER-ARCH-001 split-worker rollout

The all-in-one `worker` is selected only by the `all-in-one` profile. The
reviewed `split-workers` profile adds four isolated services, each with its own
CPU/memory cap, heartbeat, restart policy, and graceful shutdown. The
chat-event worker is selected only by `chat-workers`, which is used with the
chat-enabled split topology:

- `worker-ingestion`: feed and podcast refreshes plus article extraction.
- `worker-ai-mail`: AI/smart digest processing and email delivery.
- `worker-imports`: OPML and bulk-read work.
- `worker-maintenance`: schedulers, cleanup, reconciliation, retention, and
  source-health maintenance. A durable Redis lease permits only one scheduler
  holder at a time.
- `worker-chat-events`: chat article integration, bot scheduling, and the
  transactional outbox publisher.

Do not enable the profile in the same step as the code deployment. First
observe the existing `worker` memory and queue backlog after the code release.
At a separately approved cutover, validate the topology first and stop the
all-in-one worker before starting split workers so no queue has two intentional
owners:

```bash
cd "$APP_DIR"
docker compose --profile all-in-one stop worker
docker compose --profile all-in-one rm -f worker
docker compose --profile split-workers up -d \
  worker-ingestion worker-ai-mail worker-imports worker-maintenance
docker compose ps
```

For a chat-enabled split deployment, add `--profile chat-workers` and include
`worker-chat-events`. Verify the selected independent Docker health checks, the
administrator queue backlog, worker-mode startup logs, and the host monitor. If any capacity or
queue-ownership concern appears, stop the split services and recreate the
safe compatibility worker:

```bash
docker compose --profile split-workers stop \
  worker-ingestion worker-ai-mail worker-imports worker-maintenance
docker compose --profile split-workers rm -f \
  worker-ingestion worker-ai-mail worker-imports worker-maintenance
docker compose --profile all-in-one up -d --no-deps --force-recreate worker
```

Do not activate both forms as a steady state. BullMQ may safely coordinate
job claims during the brief cutover, but a single clear ownership model is
required for predictable capacity monitoring.

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
   docker compose run --rm --no-deps migrate \
     ./node_modules/.bin/prisma migrate status
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
  node bootstrap-admin.mjs --email admin@example.com
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
docker compose run --rm --no-deps migrate \
  ./node_modules/.bin/prisma migrate status
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

This release has no schema change. The current architecture separates
Redis-backed protected-action limits from durable queue jobs; see the
REDIS-ARCH-001 deployment section and the safe commands in
[rate-limit-turnstile-runbook.md](rate-limit-turnstile-runbook.md).

Turnstile remains optional until the Cloudflare widget keys are configured. Do
not set `TURNSTILE_REQUIRED=true` until both keys have been placed in the VPS
`.env`; otherwise the secure production configuration intentionally stops the
web service at startup. Follow the secret-safe configuration steps in the
rate-limit and Turnstile runbook, then smoke-test login, signup, and password
reset with a real challenge.

## INFRA-SEC-001 database and runtime-secret deployment

This release removes the PostgreSQL `postgres` fallback and makes Compose
refuse to render when PostgreSQL, Redis, or the migration URL is missing. The
web and worker also refuse production startup if their database URLs, Redis
credentials, or `AUTH_SECRET` are blank, template values, or incompatible.

Before deployment, make a root-only copy of the current `.env` in the retained
rollback release. Do not print either copy. Confirm the required entries exist
without displaying their values:

```bash
cd "$APP_DIR"
for key in POSTGRES_PASSWORD DATABASE_URL MIGRATE_DATABASE_URL REDIS_PASSWORD AUTH_SECRET; do
  if ! grep -q "^${key}=." .env; then
    echo "missing required environment key: ${key}" >&2
    exit 1
  fi
done
for key in DURABLE_REDIS_URL EPHEMERAL_REDIS_URL; do
  if ! grep -q "^${key}=." .env; then
    echo "missing required Redis workload key: ${key}" >&2
    exit 1
  fi
done
```

Determine whether the retired fallback was ever used without printing a
password. If the result is uncertain, rotate the PostgreSQL password and the
runtime and migration role passwords together, then update both connection
URLs in the production `.env`. Preserve the updated `.env` with the rollback
release so it can still connect after a rollback.

```bash
if grep -qx 'POSTGRES_PASSWORD=postgres' .env; then
  echo 'retired PostgreSQL fallback detected; rotate before deployment' >&2
  exit 1
fi
docker compose config -q
docker compose build migrate web worker
docker compose run --rm --no-deps migrate
docker compose up -d --no-deps --force-recreate web worker
docker compose ps
```

After the normal health, login, worker, and backup checks, confirm the
database remains loopback-only:

```bash
docker compose port postgres 5432
ss -ltn '( sport = :5432 )'
```

The published address must be `127.0.0.1` (or no host-published address). Do
not rotate `AUTH_SECRET` as part of this release; doing so globally invalidates
sessions and has its own runbook.

## Rollback

1. Keep the currently running failed release and its logs for diagnosis.
2. Use the approval-gated
   [`rollback-approved-release.ps1`](approved-release-command.md#deterministic-code-rollback)
   with the private release record created for the failed release. Select the
   record's **prior** topology, not its failed topology. Its dry run validates
   the retained source, exact prior image tags, and complete manifest rollback
   service list before it can connect to the VPS.
3. Do not substitute a copied `web worker` Compose command: split and
   chat-enabled topologies require a different complete rollback list. The
   approved command retains the failed source, removes stale application
   services, recreates every selected rollback service without migrations or a
   build, and checks recorded image tags plus local/public health.
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

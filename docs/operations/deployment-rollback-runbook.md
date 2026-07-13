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
- The current migration service uses `prisma db push`. Do **not** deploy a
  schema-changing release until DB-001 replaces this with reviewed migrations.

## Pre-deployment checklist

1. Complete [backup-restore-checklist.md](backup-restore-checklist.md).
2. Record the source commit, archive checksum, container image IDs, and active
   release directory.
3. Confirm production `.env` is present, mode 0600, and will be copied into the
   new release without printing it.
4. Confirm a recovery console is available and the previous release is intact.
5. Confirm the change is schema-compatible. If a migration is required, stop
   until it is a committed, reviewed Prisma migration with an expand/contract
   plan.

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

# Authentication-token maintenance runbook

## Scope

SEC-003 makes password-reset and email-verification tokens single-use under
concurrent requests. The database transaction conditionally claims a token
only when it has the expected hash, is unused, is unexpired, and belongs to an
active account. A claim count other than one is treated as invalid or replayed.

The same transaction applies the associated account change and records a
`SecurityEvent`:

- `PASSWORD_RESET_COMPLETED` changes the password and increments `authVersion`.
- `EMAIL_VERIFICATION_COMPLETED` marks the account verified.

The welcome message is sent only after a successful email-verification
transaction, so a replay cannot cause a duplicate welcome email.

## Scheduled cleanup

Interactive requests do not scan or delete expired tokens. The `worker`
service removes expired password-reset and email-verification tokens in bounded
batches.

```dotenv
AUTH_TOKEN_MAINTENANCE_BATCH_SIZE=100
AUTH_TOKEN_MAINTENANCE_INTERVAL_MS=900000
```

The defaults are 100 tokens per type every 15 minutes. Increase only after
checking database load and worker logs. The cleanup query selects a bounded
oldest-first batch and deletes only the selected rows that are still expired.

There must be exactly one Compose `worker` replica. Its in-process scheduler
is the maintenance-job owner. Do not use `docker compose up --scale worker=2`
unless this job is first moved to a distributed scheduler or lock.

## Deployment

1. Create and verify an off-host PostgreSQL backup following
   [backup-restore-checklist.md](backup-restore-checklist.md).
2. Review the additive migration
   `20260713040000_add_security_events`; it adds the `SecurityEvent` table and
   its user/time index only.
3. Stage the release as a clean archive, preserve the production `.env`, and
   keep the previous app directory as a rollback candidate.
4. Run the one-shot migration before starting the new services:

   ```bash
   docker compose run --rm --no-deps migrate
   docker compose run --rm --no-deps worker npx prisma migrate status
   ```

5. Rebuild and recreate the application services, then check health locally
   and through `https://arcticrss.com/api/health`.
6. Confirm one worker is running and inspect its structured logs:

   ```bash
   docker compose ps worker
   docker compose logs --tail 200 worker
   ```

## Verification and observability

Expected structured worker/application log events are:

- `auth_token_attempt` with `purpose` and an outcome of `success`, `expired`,
  `invalid`, `replayed`, or `error`.
- `auth_token_maintenance` with an `outcome` of `success` and counts of each
  expired token type deleted.

Do not log, paste into tickets, or expose a raw token, token hash, email
address, cookie, database URL, or `.env` value. Use aggregate event counts for
operations and preserve relevant logs during an incident.

## Rollback

The migration is additive and does not change existing token rows. A code
rollback reintroduces token-replay risk, so prefer a forward fix. If an
emergency rollback is unavoidable, preserve the security-event evidence,
record the degraded protection, and redeploy the SEC-003 release as soon as
service is stable. Restore the matching database backup only if the incident
requires a full schema rollback.

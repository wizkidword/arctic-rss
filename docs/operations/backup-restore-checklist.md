# Production backup and restore checklist

Use this checklist before every production mutation. It is deliberately written
without host names, user names, or secret values. Replace the variables only in
the secure server session; do not put credentials in shell history or commits.

## Pre-change backup gate

1. Confirm provider-console access and create a VPS snapshot. Record its ID and
   creation time outside this repository.
2. Confirm the active Compose directory and services with `docker compose ps`.
3. Capture the current container image IDs, Compose checksum, and app-release
   directory name.
4. Create a private backup directory with restrictive permissions:

   ```bash
   umask 077
   export APP_DIR=/opt/arctic-rss/app
   export BACKUP_DIR="$HOME/arctic-backups/$(date -u +%Y%m%dT%H%M%SZ)"
   mkdir -p "$BACKUP_DIR"
   cd "$APP_DIR"
   ```

5. Make a PostgreSQL custom-format backup without printing any environment
   values:

   ```bash
   docker compose exec -T postgres sh -lc \
     'pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
     > "$BACKUP_DIR/postgres.dump"
   test -s "$BACKUP_DIR/postgres.dump"
   pg_restore -l "$BACKUP_DIR/postgres.dump" > "$BACKUP_DIR/postgres.dump.list"
   sha256sum "$BACKUP_DIR/postgres.dump" > "$BACKUP_DIR/SHA256SUMS"
   ```

6. Back up Compose/proxy/service configuration and environment files into an
   encrypted, access-controlled location. Do not commit those backups and do
   not copy their contents into task logs.
7. Copy the database backup to encrypted off-host storage and record its
   retention date.
8. Confirm the prior release folder/image can be restored before continuing.

## Restore drill

Test restores in a disposable, non-production PostgreSQL target. Never restore
over production to validate a backup.

```bash
pg_restore --clean --if-exists --no-owner \
  --dbname="$RESTORE_DATABASE_URL" \
  "$BACKUP_DIR/postgres.dump"
```

The restore is successful only after the command finishes without errors and a
separate validation confirms expected tables and representative data. Record
the drill date, operator, target, duration, and result outside the repository.

## What a backup does not prove

- A VPS snapshot alone does not prove PostgreSQL recovery.
- An existing file does not prove the backup is readable.
- A local-only copy does not satisfy off-host recovery.
- An unencrypted `.env` copy is not an acceptable durable backup.

# Production backup and restore checklist

Use this checklist before every production mutation. It is deliberately written
without host names, user names, or secret values. Replace the variables only in
the secure server session; do not put credentials in shell history or commits.

## Automated local backup

`scripts/production-backup.sh` creates a custom-format PostgreSQL database
backup plus a separate SQL export of cluster-wide role definitions. It validates
the database archive with `pg_restore -l`, verifies checksums for both files,
and retains only the configured number of dated backup directories. The role
export may contain password hashes, so treat the whole backup directory as
sensitive and encrypt it before any off-host copy. The script requires these
non-secret systemd environment values outside the repository:

```dotenv
APP_DIR=/private/path/to/active/arctic-rss-release
BACKUP_DIR=/private/path/to/arctic-rss-backups
COMPOSE_PROJECT=app
RETENTION_DAYS=30
```

Install the matching service and timer templates from `ops/systemd/`, then
verify the timer and one manual run:

```bash
systemctl list-timers arctic-rss-backup.timer
systemctl start arctic-rss-backup.service
systemctl show arctic-rss-backup.service -p Result -p ExecMainStatus
```

The separate build-cache timer removes all unused Docker build cache every 72
hours. It does not remove running containers, images, volumes, or database
backups.

Local backups are not a disaster-recovery solution by themselves. Copy them
to encrypted off-host storage and perform regular restore drills.

For a Windows-operated off-VPS copy, use
`scripts/windows/sync-vps-backups.ps1` with a private JSON configuration file
outside the repository. It copies only a completed backup directory, verifies
both SHA-256 checksums locally, and can request a VPS email alert if the copy
fails. Its VPS counterpart, `scripts/production-latest-backup.sh`, exposes
only the identifier of a completed backup. Schedule the Windows task after the
VPS backup timer and keep its SSH host, account, and key path out of Git.

`scripts/production-notify.sh` and
`ops/systemd/arctic-rss-backup-alert@.service` provide a failure-only SMTP
alert for the automated backup job. Put `APP_DIR` and `OPS_ALERT_EMAIL` in a
root-readable `0600` server environment file; do not add them to `.env` or
the repository. Test delivery after installation before relying on the alert.

`scripts/production-monitor.sh` and its systemd timer check container health,
internal and public readiness, HTTPS certificate validity, disk and inode use,
backup freshness, Redis AOF write status, and OPML jobs stuck in pending or
processing state every five minutes. Set
`OPS_PUBLIC_HEALTH_URL` and `OPS_PUBLIC_HOST` in the same private operational
alert environment file as `APP_DIR` and `OPS_ALERT_EMAIL`; keep these settings
out of the repository. Alerts are sent only when the recorded state changes
from healthy to unhealthy or back again. The notifier falls back to a temporary
worker container if the normal worker is unavailable.

The monitor treats a pending or processing OPML import as stuck after 15
minutes by default. Set the non-secret `IMPORT_STUCK_AFTER_SECONDS` operational
environment value when a different threshold is needed. The alert identifies
only the condition; import details remain in the account's Import / Export
screen and application logs.

If a separate SSH account pulls completed backups with `scp`, set the optional
`BACKUP_READ_GROUP` in the private backup environment file. The backup script
then makes only completed backup directories group-readable (`750` directories
and `640` files). Give that group no other server permissions, and never make
the backup directory world-readable.

## Pre-change backup gate

1. Confirm provider-console access and create a VPS snapshot. Record its ID and
   creation time outside this repository.
2. Confirm the active Compose directory and services with `docker compose ps`.
3. Capture the current container image IDs, Compose checksum, and app-release
   directory name.
4. Create a private backup directory with restrictive permissions:

   ```bash
   umask 077
   export APP_DIR=/private/path/to/active/arctic-rss-release
   export BACKUP_DIR="$HOME/arctic-backups/$(date -u +%Y%m%dT%H%M%SZ)"
   mkdir -p "$BACKUP_DIR"
   cd "$APP_DIR"
   ```

5. Make a PostgreSQL custom-format backup and its role-definition companion
   without printing any environment values:

   ```bash
   docker compose exec -T postgres sh -lc \
     'pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
     > "$BACKUP_DIR/postgres.dump"
   docker compose exec -T postgres sh -lc \
     'pg_dumpall --globals-only -U "$POSTGRES_USER"' \
     > "$BACKUP_DIR/postgres.globals.sql"
   test -s "$BACKUP_DIR/postgres.dump"
   test -s "$BACKUP_DIR/postgres.globals.sql"
   pg_restore -l "$BACKUP_DIR/postgres.dump" > "$BACKUP_DIR/postgres.dump.list"
   sha256sum "$BACKUP_DIR/postgres.dump" > "$BACKUP_DIR/SHA256SUMS"
   sha256sum "$BACKUP_DIR/postgres.globals.sql" >> "$BACKUP_DIR/SHA256SUMS"
   sha256sum -c "$BACKUP_DIR/SHA256SUMS"
   ```

6. Back up Compose/proxy/service configuration and environment files into an
   encrypted, access-controlled location. Do not commit those backups and do
   not copy their contents into task logs.
7. Copy the database backup to encrypted off-host storage and record its
   retention date.
8. Confirm the prior release folder/image can be restored before continuing.

## Restore drill

Test restores in a disposable, non-production PostgreSQL target. Never restore
over production to validate a backup. On a clean test cluster, restore the
role definitions first; this recreates the application accounts and their
credential hashes. On the VPS, the installed `arctic-rss-restore-drill` tool
uses an isolated, temporary PostgreSQL 17 container with no published ports or
network access, checks both backup hashes, restores the globals and database,
validates the recovered application tables and representative data, then
removes the temporary container.

Run it as root, optionally passing one completed backup directory inside the
configured `BACKUP_DIR`:

```bash
sudo /usr/local/sbin/arctic-rss-restore-drill
```

The result is safe to record as passed or failed, but do not copy its role dump,
database dump, passwords, or detailed database contents into an issue or task
log. A root-only status record is written outside the repository after a
successful drill. Run a drill after backup-format changes and at least
quarterly.

```bash
psql --set=ON_ERROR_STOP=on --dbname=postgres \
  -f "$BACKUP_DIR/database.globals.sql"
pg_restore --clean --if-exists --no-owner \
  --dbname="$RESTORE_DATABASE_URL" \
  "$BACKUP_DIR/database.dump"
```

The restore is successful only after the command finishes without errors and a
separate validation confirms expected tables and representative data. Record
the drill date, operator, target, duration, and result outside the repository.

## What a backup does not prove

- A VPS snapshot alone does not prove PostgreSQL recovery.
- An existing file does not prove the backup is readable.
- A local-only copy does not satisfy off-host recovery.
- An unencrypted `.env` copy is not an acceptable durable backup.
- A role-definition export contains credential hashes and must receive the same
  access controls and encryption as the database archive.

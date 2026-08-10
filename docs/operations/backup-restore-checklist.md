# Production backup and restore checklist

Use this checklist before every production mutation. It is deliberately written
without host names, user names, or secret values. Replace the variables only in
the secure server session; do not put credentials in shell history or commits.

## Automated local backup

`scripts/production-backup.sh` creates a custom-format PostgreSQL database
backup plus a separate SQL export of cluster-wide role definitions. It validates
the database archive with `pg_restore -l`, verifies checksums for both files,
and retains standard timestamp directories by configured age. Each
completed directory also contains a small `backup-evidence.json` record. It
binds a versioned schema, environment, database name, backup ID, UTC completion
time, dump byte count, dump SHA-256, and a relative artifact name. The role
export may contain password hashes, so treat the whole backup directory as
sensitive and encrypt it before any off-host copy. The script requires Python
3 and these non-secret systemd environment values outside the repository:

```dotenv
APP_DIR=/private/path/to/active/arctic-rss-release
BACKUP_DIR=/private/path/to/arctic-rss-backups
COMPOSE_PROJECT=app
RETENTION_DAYS=30
# Optional: 0 preserves all timestamp backups inside the age window. A positive
# cap keeps the newest N per UTC day only after each older backup has received
# checksum-verified off-host acknowledgement.
MAX_BACKUPS_PER_DAY=0
ARCTIC_RSS_BACKUP_ENVIRONMENT=production
# Opaque label only; never put a storage URL, account, or credential here.
BACKUP_OFF_HOST_TARGET=encrypted-windows-replica
```

Install the matching service and timer templates from `ops/systemd/`, then
verify the timer and one manual run:

```bash
systemctl list-timers arctic-rss-backup.timer
systemctl start arctic-rss-backup.service
systemctl show arctic-rss-backup.service -p Result -p ExecMainStatus
```

Install the root-only helpers together before enabling this evidence
workflow. Keep their source and installed modes aligned; do not copy a backup
directory, role export, or private environment file into the repository.

```bash
install -m 700 scripts/production-backup.sh /usr/local/sbin/arctic-rss-backup
install -m 700 scripts/production-latest-backup.sh /usr/local/sbin/arctic-rss-latest-backup
install -m 700 scripts/production-record-backup-offhost.sh /usr/local/sbin/arctic-rss-record-backup-offhost
install -m 700 scripts/production-restore-drill.sh /usr/local/sbin/arctic-rss-restore-drill
install -m 700 scripts/production-register-backup-archive.sh /usr/local/sbin/arctic-rss-register-backup-archive
```

`latest-backup-evidence.json` is an atomically replaced relative symlink to
the newest completed record. Configure doctor with its stable path and the
expected identity and policy values in the same private host environment that
runs doctor:

```dotenv
ARCTIC_RSS_BACKUP_EVIDENCE_PATH=/private/path/to/arctic-rss-backups/latest-backup-evidence.json
ARCTIC_RSS_BACKUP_EXPECTED_ENVIRONMENT=production
ARCTIC_RSS_BACKUP_EXPECTED_DATABASE=the-production-database-name
ARCTIC_RSS_BACKUP_MAX_AGE_SECONDS=108000
ARCTIC_RSS_RESTORE_TEST_MAX_AGE_SECONDS=7776000
```

Doctor follows the stable link but resolves the record before checking its
relative artifact. It emits only a status and ages; it never prints the backup
path, target label, storage location, credentials, checksum, or backup data.

The separate build-cache timer removes all unused Docker build cache every 72
hours. It does not remove running containers, images, volumes, or database
backups.

Local backups are not a disaster-recovery solution by themselves. Copy them
to encrypted off-host storage and perform regular restore drills.

For a Windows-operated off-VPS copy, use
`scripts/windows/sync-vps-backups.ps1` with a private JSON configuration file
outside the repository. It copies only a completed backup directory, verifies
both SHA-256 checksums locally, then invokes the narrowly scoped root helper
with the already validated backup ID. That helper adds the configured opaque
target label and acknowledgement time to the matching evidence record
atomically; the Windows job retrieves the updated record into the off-host
copy. It can request a VPS email alert if the copy fails. Its VPS counterpart,
`scripts/production-latest-backup.sh`, exposes only the identifier of a
completed backup. Schedule the Windows task after the VPS backup timer and
keep its SSH host, account, key path, and storage details out of Git.

Grant the backup-sync account permission only to run
`/usr/local/sbin/arctic-rss-record-backup-offhost` with one timestamp-shaped
backup ID, in addition to its existing read-only backup access. Do not grant
it a shell or broad write access to the backup root. Until this acknowledgement
is present, doctor intentionally treats the backup as not off-host verified.

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

## Storage retention and capacity controls

Keep `RETENTION_DAYS=30` unless an owner explicitly changes the recovery
policy. `MAX_BACKUPS_PER_DAY=0` is the safe compatibility default. After the
checksum-verified off-host copy has a reliable cadence, an owner may set a
small positive daily cap (for example, `2`) to prevent repeated release or
manual backups from accumulating indefinitely. The cap never removes a
timestamp backup that lacks the existing `offHostVerifiedAt` acknowledgement,
and it does not affect named recovery directories.

Named recovery archives are never automatically deleted. Once an archive has
an agreed review deadline, register it with its direct directory name and a
UTC review-by date:

```bash
sudo /usr/local/sbin/arctic-rss-register-backup-archive ARCHIVE_NAME YYYY-MM-DD
```

The helper atomically writes a path-local manifest. The five-minute monitor
alerts only when a registered manifest is malformed or its review date has
passed; it does not list archive names or delete anything. Before a manual
archive removal, confirm its off-host recovery copy and record the decision in
the private operator inventory.

The monitor also keeps a 4 GiB byte-based release workspace reserve via
`RELEASE_MIN_FREE_BYTES=4294967296`, in addition to the existing percentage
and inode alarms. This is an early warning, not a release waiver: the approved
release controller remains the exact-image, archive-aware capacity gate and
can require more space. Raise the private value for larger expected images.

Release-image retention happens only after a future release passes public
health and login checks. It keeps the live tag set, the complete previous
rollback set, and any tag referenced by a container; it never prunes backups,
volumes, release directories, generic Docker cache, or journal data. The
release controller already bounds the journal to 30 days. Review old source
directories and any unregistered named recovery archives through a separate
read-only inventory before authorizing their removal.

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
successful drill, and the exact backup's evidence record is atomically updated
with `restoreTestedAt`. Run a drill after backup-format changes and at least
quarterly. Doctor rejects an absent, future, older-than-policy, or
pre-backup restore timestamp.

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
- An off-host target label without a successful checksum-verified copy and
  remote acknowledgement does not satisfy off-host evidence.
- An unencrypted `.env` copy is not an acceptable durable backup.
- A role-definition export contains credential hashes and must receive the same
  access controls and encryption as the database archive.

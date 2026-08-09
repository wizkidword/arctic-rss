#!/usr/bin/env bash
set -euo pipefail

umask 077

: "${APP_DIR:?APP_DIR is required}"
: "${BACKUP_DIR:?BACKUP_DIR is required}"

COMPOSE_PROJECT="${COMPOSE_PROJECT:-app}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
BACKUP_READ_GROUP="${BACKUP_READ_GROUP:-}"
BACKUP_ENVIRONMENT="${ARCTIC_RSS_BACKUP_ENVIRONMENT:-production}"
BACKUP_EVIDENCE_TOOL_VERSION="arctic-rss-backup-evidence-v1"

if [[ "$BACKUP_DIR" != /* ]] || [[ "$BACKUP_DIR" == "/" ]]; then
  echo "BACKUP_DIR must be a non-root absolute path." >&2
  exit 1
fi

if ! [[ "$RETENTION_DAYS" =~ ^[1-9][0-9]*$ ]]; then
  echo "RETENTION_DAYS must be a positive whole number." >&2
  exit 1
fi

if [[ -n "$BACKUP_READ_GROUP" ]] && ! getent group "$BACKUP_READ_GROUP" >/dev/null; then
  echo "BACKUP_READ_GROUP does not exist." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
if [[ -n "$BACKUP_READ_GROUP" ]]; then
  chgrp "$BACKUP_READ_GROUP" "$BACKUP_DIR"
  chmod 750 "$BACKUP_DIR"
fi
exec 9>"$BACKUP_DIR/.backup.lock"

if ! flock -n 9; then
  echo "An Arctic RSS backup is already running."
  exit 0
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
completed_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
staging="$(mktemp -d "$BACKUP_DIR/.staging-$timestamp-XXXXXX")"
final="$BACKUP_DIR/$timestamp"

cleanup() {
  rm -rf -- "$staging"
}
trap cleanup EXIT

cd "$APP_DIR"
docker compose -p "$COMPOSE_PROJECT" exec -T postgres \
  sh -c 'pg_dump -Fc -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  </dev/null > "$staging/database.dump"
docker compose -p "$COMPOSE_PROJECT" exec -T postgres pg_restore -l \
  < "$staging/database.dump" > "$staging/database.catalog"
docker compose -p "$COMPOSE_PROJECT" exec -T postgres \
  sh -c 'pg_dumpall --globals-only -U "$POSTGRES_USER"' \
  </dev/null > "$staging/database.globals.sql"
database_name="$(docker compose -p "$COMPOSE_PROJECT" exec -T postgres \
  sh -c 'printf %s "$POSTGRES_DB"')"

test -s "$staging/database.dump"
test -s "$staging/database.catalog"
test -s "$staging/database.globals.sql"
grep -q '^CREATE ROLE ' "$staging/database.globals.sql"
(
  cd "$staging"
  sha256sum database.dump > database.dump.sha256
  sha256sum -c database.dump.sha256 >/dev/null
  sha256sum database.globals.sql > database.globals.sql.sha256
  sha256sum -c database.globals.sql.sha256 >/dev/null
)
printf 'created_at=%s\n' "$timestamp" > "$staging/metadata"
dump_bytes="$(stat --format=%s "$staging/database.dump")"
dump_sha256="$(awk 'NR == 1 { print $1 }' "$staging/database.dump.sha256")"

python3 - "$staging/backup-evidence.json" "$BACKUP_ENVIRONMENT" "$database_name" \
  "$timestamp" "$completed_at" "$dump_bytes" "$dump_sha256" "$BACKUP_EVIDENCE_TOOL_VERSION" <<'PY'
import json
import sys

path, environment, database, backup_id, completed_at, bytes_written, sha256, tool_version = sys.argv[1:]
if not environment or not database or not backup_id or not completed_at:
    raise SystemExit("Backup evidence identity is incomplete.")
if not bytes_written.isdigit() or int(bytes_written) <= 0:
    raise SystemExit("Backup evidence artifact is empty.")
if len(sha256) != 64 or any(character not in "0123456789abcdef" for character in sha256.lower()):
    raise SystemExit("Backup evidence checksum is invalid.")

with open(path, "w", encoding="utf-8") as handle:
    json.dump({
        "schemaVersion": 1,
        "environment": environment,
        "database": database,
        "backupId": backup_id,
        "completedAt": completed_at,
        "bytes": int(bytes_written),
        "sha256": sha256.lower(),
        "artifactPath": "database.dump",
        "offHostTarget": None,
        "offHostVerifiedAt": None,
        "restoreTestedAt": None,
        "toolVersion": tool_version,
    }, handle, separators=(",", ":"), sort_keys=True)
    handle.write("\n")
PY

mv "$staging" "$final"
trap - EXIT

if [[ -n "$BACKUP_READ_GROUP" ]]; then
  chgrp -R "$BACKUP_READ_GROUP" "$final"
  find "$final" -type d -exec chmod 750 {} +
  find "$final" -type f -exec chmod 640 {} +
fi

latest_evidence_link="$BACKUP_DIR/latest-backup-evidence.json"
latest_evidence_staging="$BACKUP_DIR/.latest-backup-evidence-$timestamp"
ln -s "$timestamp/backup-evidence.json" "$latest_evidence_staging"
mv -Tf "$latest_evidence_staging" "$latest_evidence_link"

while IFS= read -r -d '' expired; do
  rm -rf -- "$expired"
done < <(
  find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d \
    -name '20??????T??????Z' -mtime "+$RETENTION_DAYS" -print0
)

echo "Arctic RSS backup verified: $timestamp"

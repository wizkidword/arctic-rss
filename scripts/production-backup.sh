#!/usr/bin/env bash
set -euo pipefail

umask 077

: "${APP_DIR:?APP_DIR is required}"
: "${BACKUP_DIR:?BACKUP_DIR is required}"

COMPOSE_PROJECT="${COMPOSE_PROJECT:-app}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

if [[ "$BACKUP_DIR" != /* ]] || [[ "$BACKUP_DIR" == "/" ]]; then
  echo "BACKUP_DIR must be a non-root absolute path." >&2
  exit 1
fi

if ! [[ "$RETENTION_DAYS" =~ ^[1-9][0-9]*$ ]]; then
  echo "RETENTION_DAYS must be a positive whole number." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
exec 9>"$BACKUP_DIR/.backup.lock"

if ! flock -n 9; then
  echo "An Arctic RSS backup is already running."
  exit 0
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
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

test -s "$staging/database.dump"
test -s "$staging/database.catalog"
sha256sum "$staging/database.dump" > "$staging/database.dump.sha256"
printf 'created_at=%s\n' "$timestamp" > "$staging/metadata"

mv "$staging" "$final"
trap - EXIT

while IFS= read -r -d '' expired; do
  rm -rf -- "$expired"
done < <(
  find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d \
    -name '20????????T??????Z' -mtime "+$RETENTION_DAYS" -print0
)

echo "Arctic RSS backup verified: $final"

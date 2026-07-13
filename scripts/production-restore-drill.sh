#!/usr/bin/env bash
set -euo pipefail

umask 077

BACKUP_ENV_FILE="${BACKUP_ENV_FILE:-/etc/arctic-rss/backup.env}"
RESTORE_IMAGE="${POSTGRES_RESTORE_IMAGE:-postgres:17-alpine}"
RESTORE_MEMORY_LIMIT="${RESTORE_MEMORY_LIMIT:-512m}"
RESTORE_CPU_LIMIT="${RESTORE_CPU_LIMIT:-0.75}"
RESTORE_PIDS_LIMIT="${RESTORE_PIDS_LIMIT:-128}"
STATE_DIR="${RESTORE_DRILL_STATE_DIR:-/var/lib/arctic-rss-restore-drill}"

if (( EUID != 0 )); then
  echo "The restore drill must run as root so it can read protected backups." >&2
  exit 1
fi

if [[ ! -r "$BACKUP_ENV_FILE" ]]; then
  echo "Backup environment file is not readable." >&2
  exit 1
fi

set -a
# The file is root-controlled and stores private operational settings outside Git.
# shellcheck disable=SC1090
. "$BACKUP_ENV_FILE"
set +a

: "${BACKUP_DIR:?BACKUP_DIR is required}"

if [[ "$BACKUP_DIR" != /* ]] || [[ "$BACKUP_DIR" == "/" ]]; then
  echo "BACKUP_DIR must be a non-root absolute path." >&2
  exit 1
fi

backup_root="$(readlink -f -- "$BACKUP_DIR")"
if [[ $# -gt 1 ]]; then
  echo "Usage: $0 [completed-backup-directory]" >&2
  exit 1
fi

if [[ $# -eq 1 ]]; then
  backup_path="$(readlink -f -- "$1")"
else
  backup_name="$(find "$backup_root" -mindepth 1 -maxdepth 1 -type d -name '20??????T??????Z' -printf '%f\n' | sort | tail -n 1)"
  if [[ -z "$backup_name" ]]; then
    echo "No completed backup is available for a restore drill." >&2
    exit 1
  fi
  backup_path="$backup_root/$backup_name"
fi

case "$backup_path" in
  "$backup_root"/*) ;;
  *)
    echo "Restore drill backup must be inside BACKUP_DIR." >&2
    exit 1
    ;;
esac

for file in database.dump database.dump.sha256 database.globals.sql database.globals.sql.sha256 metadata; do
  if [[ ! -f "$backup_path/$file" ]]; then
    echo "Backup is missing required file: $file" >&2
    exit 1
  fi
done

(
  cd "$backup_path"
  sha256sum -c database.dump.sha256 >/dev/null
  sha256sum -c database.globals.sql.sha256 >/dev/null
)

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
container="arctic-rss-restore-drill-$stamp"
restore_user="restore_admin"
restore_password="$(openssl rand -hex 32)"

cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
}
trap cleanup EXIT

if docker container inspect "$container" >/dev/null 2>&1; then
  echo "Restore drill container name is already in use." >&2
  exit 1
fi

docker run -d \
  --name "$container" \
  --network none \
  --memory "$RESTORE_MEMORY_LIMIT" \
  --cpus "$RESTORE_CPU_LIMIT" \
  --pids-limit "$RESTORE_PIDS_LIMIT" \
  -e POSTGRES_DB=postgres \
  -e POSTGRES_USER="$restore_user" \
  -e POSTGRES_PASSWORD="$restore_password" \
  "$RESTORE_IMAGE" >/dev/null

for _ in {1..30}; do
  if docker exec -e PGPASSWORD="$restore_password" "$container" \
    pg_isready --quiet --username "$restore_user" --dbname postgres; then
    break
  fi
  sleep 1
done

if ! docker exec -e PGPASSWORD="$restore_password" "$container" \
  pg_isready --quiet --username "$restore_user" --dbname postgres; then
  echo "Temporary restore database did not become ready." >&2
  exit 1
fi

docker cp "$backup_path/database.globals.sql" "$container:/tmp/database.globals.sql"
docker cp "$backup_path/database.dump" "$container:/tmp/database.dump"

docker exec -e PGPASSWORD="$restore_password" "$container" \
  psql --set=ON_ERROR_STOP=on --username "$restore_user" --dbname postgres \
  --file /tmp/database.globals.sql >/dev/null
docker exec -e PGPASSWORD="$restore_password" "$container" \
  pg_restore --exit-on-error --clean --if-exists --no-owner \
  --username "$restore_user" --dbname postgres /tmp/database.dump >/dev/null

table_count="$(docker exec -e PGPASSWORD="$restore_password" "$container" \
  psql --tuples-only --no-align --username "$restore_user" --dbname postgres \
  --command "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';")"
if ! [[ "$table_count" =~ ^[1-9][0-9]*$ ]]; then
  echo "Restore drill did not recover application tables." >&2
  exit 1
fi

representative_data="$(docker exec -e PGPASSWORD="$restore_password" "$container" \
  psql --tuples-only --no-align --username "$restore_user" --dbname postgres \
  --command "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '_prisma_migrations') AND EXISTS (SELECT 1 FROM public.\"User\");")"
if [[ "$representative_data" != t ]]; then
  echo "Restore drill did not recover expected migration and user data." >&2
  exit 1
fi

mkdir -p "$STATE_DIR"
chmod 700 "$STATE_DIR"
printf 'completed_at=%s\nbackup=%s\nresult=passed\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$(basename "$backup_path")" \
  > "$STATE_DIR/latest-success"
chmod 600 "$STATE_DIR/latest-success"

printf 'Arctic RSS restore drill passed: backup=%s tables=validated representative_data=present\n' "$(basename "$backup_path")"

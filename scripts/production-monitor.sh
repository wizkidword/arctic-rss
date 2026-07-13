#!/usr/bin/env bash
set -euo pipefail

ALERT_ENV_FILE="${OPS_ALERT_ENV_FILE:-/etc/arctic-rss/alerts.env}"
BACKUP_ENV_FILE="${BACKUP_ENV_FILE:-/etc/arctic-rss/backup.env}"
STATE_DIR="${MONITOR_STATE_DIR:-/var/lib/arctic-rss-monitor}"
DISK_THRESHOLD_PERCENT="${DISK_THRESHOLD_PERCENT:-85}"
BACKUP_MAX_AGE_SECONDS="${BACKUP_MAX_AGE_SECONDS:-108000}"
TLS_MIN_VALIDITY_SECONDS="${TLS_MIN_VALIDITY_SECONDS:-2592000}"
IMPORT_STUCK_AFTER_SECONDS="${IMPORT_STUCK_AFTER_SECONDS:-900}"

if [[ ! -r "$ALERT_ENV_FILE" ]] || [[ ! -r "$BACKUP_ENV_FILE" ]]; then
  echo "Required monitor environment file is not readable." >&2
  exit 1
fi

set -a
# Both files are root-controlled and store private operational values outside Git.
# shellcheck disable=SC1090
. "$ALERT_ENV_FILE"
# shellcheck disable=SC1090
. "$BACKUP_ENV_FILE"
set +a

: "${APP_DIR:?APP_DIR is required}"
: "${BACKUP_DIR:?BACKUP_DIR is required}"
: "${OPS_PUBLIC_HEALTH_URL:?OPS_PUBLIC_HEALTH_URL is required}"
: "${OPS_PUBLIC_HOST:?OPS_PUBLIC_HOST is required}"

if ! [[ "$DISK_THRESHOLD_PERCENT" =~ ^[1-9][0-9]?$|^100$ ]]; then
  echo "DISK_THRESHOLD_PERCENT must be between 1 and 100." >&2
  exit 1
fi

if ! [[ "$BACKUP_MAX_AGE_SECONDS" =~ ^[1-9][0-9]*$ ]]; then
  echo "BACKUP_MAX_AGE_SECONDS must be a positive whole number." >&2
  exit 1
fi

if ! [[ "$TLS_MIN_VALIDITY_SECONDS" =~ ^[1-9][0-9]*$ ]]; then
  echo "TLS_MIN_VALIDITY_SECONDS must be a positive whole number." >&2
  exit 1
fi

if ! [[ "$IMPORT_STUCK_AFTER_SECONDS" =~ ^[1-9][0-9]*$ ]]; then
  echo "IMPORT_STUCK_AFTER_SECONDS must be a positive whole number." >&2
  exit 1
fi

mkdir -p "$STATE_DIR"
chmod 700 "$STATE_DIR"
STATE_FILE="$STATE_DIR/state"
failures=()

check_healthy_container() {
  local container_name="$1"
  local health

  health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_name" 2>/dev/null || true)"
  if [[ "$health" != healthy ]]; then
    failures+=("$container_name")
  fi
}

check_healthy_container app-web-1
check_healthy_container app-worker-1
check_healthy_container app-postgres-1
check_healthy_container app-redis-1

if ! curl --fail --silent --show-error --max-time 10 \
  -H "Host: $OPS_PUBLIC_HOST" \
  http://127.0.0.1:3000/api/health >/dev/null; then
  failures+=("readiness")
fi

if ! curl --fail --silent --show-error --max-time 20 "$OPS_PUBLIC_HEALTH_URL" >/dev/null; then
  failures+=("public_readiness")
fi

if ! timeout 20 openssl s_client -connect "$OPS_PUBLIC_HOST:443" -servername "$OPS_PUBLIC_HOST" </dev/null 2>/dev/null \
  | openssl x509 -noout -checkend "$TLS_MIN_VALIDITY_SECONDS" >/dev/null; then
  failures+=("tls_expiry")
fi

disk_percent="$(df -P / | awk 'NR == 2 {gsub(/%/, "", $5); print $5}')"
inode_percent="$(df -Pi / | awk 'NR == 2 {gsub(/%/, "", $5); print $5}')"
if (( disk_percent >= DISK_THRESHOLD_PERCENT )); then
  failures+=("disk")
fi
if (( inode_percent >= DISK_THRESHOLD_PERCENT )); then
  failures+=("inodes")
fi

latest_backup="$(find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name '20??????T??????Z' -printf '%f\n' | sort | tail -n 1)"
if [[ -z "$latest_backup" ]]; then
  failures+=("backup_missing")
else
  backup_timestamp="${latest_backup:0:4}-${latest_backup:4:2}-${latest_backup:6:2} ${latest_backup:9:2}:${latest_backup:11:2}:${latest_backup:13:2} UTC"
  backup_epoch="$(date -u -d "$backup_timestamp" +%s 2>/dev/null || true)"
  now_epoch="$(date -u +%s)"
  if [[ -z "$backup_epoch" ]] || (( now_epoch - backup_epoch > BACKUP_MAX_AGE_SECONDS )); then
    failures+=("backup_stale")
  fi
fi

if ! docker exec app-redis-1 sh -c 'redis-cli --no-auth-warning -a "$REDIS_PASSWORD" INFO persistence' \
  | tr -d '\r' \
  | grep -q '^aof_last_write_status:ok$'; then
  failures+=("redis_persistence")
fi

stuck_import_count="$(
  docker exec \
    -e "IMPORT_STUCK_AFTER_SECONDS=$IMPORT_STUCK_AFTER_SECONDS" \
    app-postgres-1 \
    sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c "SELECT count(*) FROM \"ImportJob\" WHERE \"status\" IN ('\''PENDING'\'', '\''PROCESSING'\'') AND \"updatedAt\" < NOW() - make_interval(secs => ${IMPORT_STUCK_AFTER_SECONDS});"' \
    2>/dev/null || true
)"
if ! [[ "$stuck_import_count" =~ ^[0-9]+$ ]]; then
  failures+=("import_job_probe")
elif (( stuck_import_count > 0 )); then
  failures+=("stuck_opml_imports")
fi

current_state="ok"
if (( ${#failures[@]} > 0 )); then
  current_state="$(IFS=,; echo "${failures[*]}")"
fi
previous_state="$(cat "$STATE_FILE" 2>/dev/null || echo unknown)"

if [[ "$current_state" != "$previous_state" ]]; then
  if [[ "$current_state" == ok ]]; then
    if [[ "$previous_state" != unknown ]]; then
      /usr/local/sbin/arctic-rss-notify host-monitor-recovered "previous:$previous_state"
    fi
  else
    /usr/local/sbin/arctic-rss-notify host-monitor-failed "$current_state"
  fi
  printf '%s\n' "$current_state" > "$STATE_FILE"
  chmod 600 "$STATE_FILE"
fi

echo "Arctic RSS monitor state: $current_state"

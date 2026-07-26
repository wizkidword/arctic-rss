#!/usr/bin/env bash
set -euo pipefail

ALERT_ENV_FILE="${OPS_ALERT_ENV_FILE:-/etc/arctic-rss/alerts.env}"
BACKUP_ENV_FILE="${BACKUP_ENV_FILE:-/etc/arctic-rss/backup.env}"
STATE_DIR="${MONITOR_STATE_DIR:-/var/lib/arctic-rss-monitor}"
DISK_THRESHOLD_PERCENT="${DISK_THRESHOLD_PERCENT:-85}"
BACKUP_MAX_AGE_SECONDS="${BACKUP_MAX_AGE_SECONDS:-108000}"
TLS_MIN_VALIDITY_SECONDS="${TLS_MIN_VALIDITY_SECONDS:-2592000}"
IMPORT_STUCK_AFTER_SECONDS="${IMPORT_STUCK_AFTER_SECONDS:-900}"
REDIS_FRAGMENTATION_MAX_RATIO="${REDIS_FRAGMENTATION_MAX_RATIO:-1.5}"

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

if ! [[ "$REDIS_FRAGMENTATION_MAX_RATIO" =~ ^[1-9][0-9]*(\.[0-9]+)?$ ]]; then
  echo "REDIS_FRAGMENTATION_MAX_RATIO must be a positive number." >&2
  exit 1
fi

mkdir -p "$STATE_DIR"
chmod 700 "$STATE_DIR"
STATE_FILE="$STATE_DIR/state"
REDIS_METRICS_FILE="$STATE_DIR/redis-metrics"
failures=()
declare -A previous_redis_metrics=()
declare -A current_redis_metrics=()

if [[ -r "$REDIS_METRICS_FILE" ]]; then
  while IFS='=' read -r metric value; do
    if [[ "$metric" =~ ^[a-z_]+$ ]] && [[ "$value" =~ ^[0-9]+$ ]]; then
      previous_redis_metrics["$metric"]="$value"
    fi
  done < "$REDIS_METRICS_FILE"
fi

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
check_healthy_container app-redis-ephemeral-1

# Split workers are opt-in during capacity rollout. Once present, each has an
# independent heartbeat health check and must participate in host monitoring.
for split_worker in \
  app-worker-ingestion-1 \
  app-worker-ai-mail-1 \
  app-worker-imports-1 \
  app-worker-maintenance-1 \
  app-worker-chat-events-1; do
  if docker inspect "$split_worker" >/dev/null 2>&1; then
    check_healthy_container "$split_worker"
  fi
done

# The gateway is an opt-in profile. When it is running, its Compose healthcheck
# probes /ready, and this explicit probe makes a lost Redis subscription visible
# to the existing host alert flow without exposing gateway traffic publicly.
if docker inspect app-chat-gateway-1 >/dev/null 2>&1; then
  check_healthy_container app-chat-gateway-1
  if ! docker exec app-chat-gateway-1 node -e \
    "fetch('http://127.0.0.1:3001/ready').then((response) => { if (!response.ok) process.exit(1) }).catch(() => process.exit(1))"; then
    failures+=("chat_gateway_ready")
  fi
fi

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

redis_config_value() {
  local container_name="$1"
  local setting="$2"

  docker exec "$container_name" sh -c 'redis-cli --no-auth-warning -a "$REDIS_PASSWORD" CONFIG GET "$1"' sh "$setting" \
    | tr -d '\r' \
    | sed -n '2p'
}

redis_info_value() {
  local container_name="$1"
  local section="$2"
  local field="$3"
  local info

  info="$(docker exec "$container_name" sh -c 'redis-cli --no-auth-warning -a "$REDIS_PASSWORD" INFO "$1"' sh "$section")" || return 1
  awk -F: -v field="$field" '$1 == field { gsub(/\r/, "", $2); print $2; found = 1 } END { exit !found }' <<< "$info"
}

redis_error_count() {
  local container_name="$1"
  local error_name="$2"
  local info

  info="$(docker exec "$container_name" sh -c 'redis-cli --no-auth-warning -a "$REDIS_PASSWORD" INFO errorstats')" || return 1
  awk -F'[=:,]' -v error_name="$error_name" '$1 == error_name { print $3; found = 1 } END { if (!found) print 0 }' <<< "$info"
}

record_redis_counter() {
  local metric="$1"
  local value="$2"
  local previous_value="${previous_redis_metrics[$metric]:-}"

  if ! [[ "$value" =~ ^[0-9]+$ ]]; then
    failures+=("redis_${metric}_probe")
    return
  fi

  current_redis_metrics["$metric"]="$value"
  if [[ "$previous_value" =~ ^[0-9]+$ ]] && (( value > previous_value )); then
    failures+=("redis_${metric}")
  fi
}

if [[ "$(redis_config_value app-redis-1 appendonly || true)" != yes ]]; then
  failures+=("redis_durable_persistence_configuration")
fi
if [[ "$(redis_config_value app-redis-1 maxmemory-policy || true)" != noeviction ]]; then
  failures+=("redis_durable_memory_policy")
fi
if [[ "$(redis_config_value app-redis-ephemeral-1 appendonly || true)" != no ]]; then
  failures+=("redis_ephemeral_persistence_configuration")
fi
if [[ "$(redis_config_value app-redis-ephemeral-1 maxmemory-policy || true)" != volatile-ttl ]]; then
  failures+=("redis_ephemeral_memory_policy")
fi

if ! docker exec app-redis-1 sh -c 'redis-cli --no-auth-warning -a "$REDIS_PASSWORD" INFO persistence' \
  | tr -d '\r' \
  | grep -q '^aof_last_write_status:ok$'; then
  failures+=("redis_durable_persistence")
fi

for redis_workload in durable ephemeral; do
  if [[ "$redis_workload" == durable ]]; then
    redis_container="app-redis-1"
  else
    redis_container="app-redis-ephemeral-1"
  fi

  rejected_connections="$(redis_info_value "$redis_container" stats rejected_connections || true)"
  rejected_commands="$(redis_info_value "$redis_container" stats total_error_replies || true)"
  oom_commands="$(redis_error_count "$redis_container" errorstat_OOM || true)"
  fragmentation_ratio="$(redis_info_value "$redis_container" memory mem_fragmentation_ratio || true)"

  record_redis_counter "${redis_workload}_rejected_connections" "$rejected_connections"
  record_redis_counter "${redis_workload}_rejected_commands" "$rejected_commands"
  record_redis_counter "${redis_workload}_oom_commands" "$oom_commands"

  if ! [[ "$fragmentation_ratio" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
    failures+=("redis_${redis_workload}_fragmentation_probe")
  elif awk -v actual="$fragmentation_ratio" -v maximum="$REDIS_FRAGMENTATION_MAX_RATIO" 'BEGIN { exit !(actual > maximum) }'; then
    failures+=("redis_${redis_workload}_fragmentation")
  fi
done

redis_metrics_tmp="$(mktemp "$STATE_DIR/redis-metrics.XXXXXX")"
for metric in "${!current_redis_metrics[@]}"; do
  printf '%s=%s\n' "$metric" "${current_redis_metrics[$metric]}"
done | sort > "$redis_metrics_tmp"
chmod 600 "$redis_metrics_tmp"
mv "$redis_metrics_tmp" "$REDIS_METRICS_FILE"

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

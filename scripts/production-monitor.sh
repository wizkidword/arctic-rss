#!/usr/bin/env bash
set -euo pipefail

ALERT_ENV_FILE="${OPS_ALERT_ENV_FILE:-/etc/arctic-rss/alerts.env}"
BACKUP_ENV_FILE="${BACKUP_ENV_FILE:-/etc/arctic-rss/backup.env}"
STATE_DIR="${MONITOR_STATE_DIR:-/var/lib/arctic-rss-monitor}"
DISK_THRESHOLD_PERCENT="${DISK_THRESHOLD_PERCENT:-85}"
# The normal percentage threshold detects a generally full filesystem.  This
# lower, byte-based reserve gives an early warning when a typical off-host
# image release would no longer have its required transfer/load workspace.
RELEASE_MIN_FREE_BYTES="${RELEASE_MIN_FREE_BYTES:-4294967296}"
BACKUP_MAX_AGE_SECONDS="${BACKUP_MAX_AGE_SECONDS:-108000}"
TLS_MIN_VALIDITY_SECONDS="${TLS_MIN_VALIDITY_SECONDS:-2592000}"
IMPORT_STUCK_AFTER_SECONDS="${IMPORT_STUCK_AFTER_SECONDS:-900}"
REDIS_FRAGMENTATION_MAX_RATIO="${REDIS_FRAGMENTATION_MAX_RATIO:-1.5}"
REDIS_FRAGMENTATION_MIN_BYTES="${REDIS_FRAGMENTATION_MIN_BYTES:-16777216}"

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

TOPOLOGY_RESOLVER="${TOPOLOGY_RESOLVER:-/usr/local/sbin/arctic-rss-monitor-topology}"
if [[ ! -x "$TOPOLOGY_RESOLVER" ]]; then
  echo "Required monitor topology resolver is not executable." >&2
  exit 1
fi

if ! topology_configuration="$($TOPOLOGY_RESOLVER)"; then
  echo "Could not resolve the active monitor topology." >&2
  exit 1
fi

release_compose_project=""
selected_topology=""
chat_enabled=""
edge_proxy_enabled=""
required_health_services=()
required_worker_modes=()
while IFS= read -r topology_line; do
  topology_key="${topology_line%%=*}"
  topology_value="${topology_line#*=}"
  case "$topology_key" in
    compose_project)
      [[ -z "$release_compose_project" ]] || { echo "Monitor topology repeats its Compose project." >&2; exit 1; }
      release_compose_project="$topology_value"
      ;;
    topology)
      [[ -z "$selected_topology" ]] || { echo "Monitor topology repeats its name." >&2; exit 1; }
      selected_topology="$topology_value"
      ;;
    chat_enabled)
      [[ -z "$chat_enabled" ]] || { echo "Monitor topology repeats chat state." >&2; exit 1; }
      chat_enabled="$topology_value"
      ;;
    edge_proxy_enabled)
      [[ -z "$edge_proxy_enabled" ]] || { echo "Monitor topology repeats edge proxy state." >&2; exit 1; }
      edge_proxy_enabled="$topology_value"
      ;;
    required_service)
      required_health_services+=("$topology_value")
      ;;
    required_worker_mode)
      required_worker_modes+=("$topology_value")
      ;;
    *)
      echo "Monitor topology emitted an unknown setting." >&2
      exit 1
      ;;
  esac
done <<< "$topology_configuration"

if [[ ! "$release_compose_project" =~ ^[a-z0-9][a-z0-9_-]{0,62}$ ]] ||
  [[ ! "$selected_topology" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] ||
  [[ "$chat_enabled" != true && "$chat_enabled" != false ]] ||
  [[ "$edge_proxy_enabled" != true && "$edge_proxy_enabled" != false ]] ||
  (( ${#required_health_services[@]} == 0 )) ||
  (( ${#required_worker_modes[@]} == 0 )); then
  echo "Monitor topology output is incomplete or invalid." >&2
  exit 1
fi

if [[ -n "${COMPOSE_PROJECT:-}" && "$COMPOSE_PROJECT" != "$release_compose_project" ]]; then
  echo "Configured Compose project does not match the active release record." >&2
  exit 1
fi
COMPOSE_PROJECT="$release_compose_project"

for worker_mode in "${required_worker_modes[@]}"; do
  worker_is_required=false
  for service_name in "${required_health_services[@]}"; do
    if [[ "$service_name" == "$worker_mode" ]]; then
      worker_is_required=true
      break
    fi
  done
  if [[ "$worker_is_required" != true ]]; then
    echo "Monitor topology has an unrequired worker mode." >&2
    exit 1
  fi
done

# Stateful Redis containers are intentionally not recreated by application
# releases. Their running environment can therefore predate the current
# Compose definition. Use the root-owned live environment only for each
# short-lived diagnostic exec, rather than weakening Redis ACLs or assuming
# the container still exposes its credentials.
REDIS_ENV_FILE="${REDIS_ENV_FILE:-$APP_DIR/.env}"
if [[ ! -r "$REDIS_ENV_FILE" ]]; then
  echo "Required Redis environment file is not readable." >&2
  exit 1
fi

if ! [[ "$DISK_THRESHOLD_PERCENT" =~ ^[1-9][0-9]?$|^100$ ]]; then
  echo "DISK_THRESHOLD_PERCENT must be between 1 and 100." >&2
  exit 1
fi

if ! [[ "$RELEASE_MIN_FREE_BYTES" =~ ^[1-9][0-9]*$ ]]; then
  echo "RELEASE_MIN_FREE_BYTES must be a positive whole number." >&2
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

if ! [[ "$REDIS_FRAGMENTATION_MIN_BYTES" =~ ^[0-9]+$ ]]; then
  echo "REDIS_FRAGMENTATION_MIN_BYTES must be a non-negative whole number." >&2
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

container_name_for_service() {
  local service_name="$1"

  printf '%s-%s-1' "$COMPOSE_PROJECT" "$service_name"
}

check_healthy_service() {
  local service_name="$1"
  local container_name
  local health

  container_name="$(container_name_for_service "$service_name")"
  health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_name" 2>/dev/null || true)"
  if [[ "$health" != healthy ]]; then
    failures+=("$container_name")
  fi
}

for service_name in "${required_health_services[@]}"; do
  case "$service_name" in
    chat-gateway|edge-proxy)
      ;;
    *)
      check_healthy_service "$service_name"
      ;;
  esac
done

if [[ "$edge_proxy_enabled" == true ]]; then
  check_healthy_service edge-proxy
fi

# The gateway is selected only by chat topologies. Its Compose healthcheck
# probes /ready, and this explicit probe makes a lost Redis subscription visible
# to the existing host alert flow without exposing gateway traffic publicly.
if [[ "$chat_enabled" == true ]]; then
  check_healthy_service chat-gateway
  chat_gateway_container="$(container_name_for_service chat-gateway)"
  if ! docker exec "$chat_gateway_container" node -e \
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
disk_available_kib="$(df -Pk / | awk 'NR == 2 {print $4}')"
inode_percent="$(df -Pi / | awk 'NR == 2 {gsub(/%/, "", $5); print $5}')"
if (( disk_percent >= DISK_THRESHOLD_PERCENT )); then
  failures+=("disk")
fi
if ! [[ "$disk_available_kib" =~ ^[0-9]+$ ]] || (( disk_available_kib * 1024 < RELEASE_MIN_FREE_BYTES )); then
  failures+=("release_disk_reserve")
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

# Named recovery archives are intentionally outside automatic expiry.  An
# operator can register a review deadline with the root-only helper; this
# monitor emits a path-free alert once that deadline has passed.  Unregistered
# historical directories remain untouched to avoid converting an inventory
# migration into a destructive retention policy change.
while IFS= read -r -d '' archive_manifest; do
  if ! archive_review_state="$(python3 - "$archive_manifest" <<'PY'
import datetime as dt
import json
import os
import re
import sys

path = sys.argv[1]
try:
    with open(path, encoding="utf-8") as handle:
        manifest = json.load(handle)
    archive_name = manifest["archiveName"]
    review_by = manifest["reviewBy"]
    schema_version = manifest["schemaVersion"]
except (OSError, ValueError, KeyError, TypeError):
    raise SystemExit(1)

if schema_version != 1 or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}", archive_name):
    raise SystemExit(1)
if archive_name != os.path.basename(os.path.dirname(path)):
    raise SystemExit(1)
try:
    review_date = dt.date.fromisoformat(review_by)
except ValueError:
    raise SystemExit(1)

print("expired" if dt.datetime.now(dt.timezone.utc).date() > review_date else "active")
PY
  )"; then
    failures+=("backup_archive_manifest")
  elif [[ "$archive_review_state" == expired ]]; then
    failures+=("backup_archive_review")
  fi
done < <(find "$BACKUP_DIR" -mindepth 2 -maxdepth 2 -type f -name '.arctic-rss-archive.json' -print0)

redis_cli() {
  local service_name="$1"
  local container_name
  shift

  container_name="$(container_name_for_service "$service_name")"

  case "$service_name" in
    redis)
      docker exec --env-file "$REDIS_ENV_FILE" "$container_name" sh -c 'redis-cli --no-auth-warning --user "$DURABLE_REDIS_USERNAME" -a "$DURABLE_REDIS_PASSWORD" "$@"' sh "$@"
      ;;
    redis-ephemeral)
      docker exec --env-file "$REDIS_ENV_FILE" "$container_name" sh -c 'redis-cli --no-auth-warning --user "$EPHEMERAL_REDIS_USERNAME" -a "$EPHEMERAL_REDIS_PASSWORD" "$@"' sh "$@"
      ;;
    *)
      return 64
      ;;
  esac
}

redis_start_option() {
  local service_name="$1"
  local setting="$2"
  local container_name

  container_name="$(container_name_for_service "$service_name")"

  # Redis correctly withholds CONFIG from the application ACL. The Compose
  # command is immutable container metadata, so inspect the launch arguments
  # instead of granting an administrative command merely for monitoring.
  docker inspect "$container_name" | python3 -c '
import json
import sys

setting = "--" + sys.argv[1]
arguments = json.load(sys.stdin)[0].get("Config", {}).get("Cmd") or []
for index, value in enumerate(arguments):
    if value == setting and index + 1 < len(arguments):
        print(arguments[index + 1])
        break
else:
    raise SystemExit(1)
' "$setting"
}

redis_info_value() {
  local container_name="$1"
  local section="$2"
  local field="$3"
  local info

  info="$(redis_cli "$container_name" INFO "$section")" || return 1
  awk -F: -v field="$field" '$1 == field { gsub(/\r/, "", $2); print $2; found = 1 } END { exit !found }' <<< "$info"
}

redis_error_count() {
  local container_name="$1"
  local error_name="$2"
  local info

  info="$(redis_cli "$container_name" INFO errorstats)" || return 1
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

if [[ "$(redis_start_option redis appendonly || true)" != yes ]]; then
  failures+=("redis_durable_persistence_configuration")
fi
if [[ "$(redis_start_option redis maxmemory-policy || true)" != noeviction ]]; then
  failures+=("redis_durable_memory_policy")
fi
if [[ "$(redis_start_option redis-ephemeral appendonly || true)" != no ]]; then
  failures+=("redis_ephemeral_persistence_configuration")
fi
if [[ "$(redis_start_option redis-ephemeral maxmemory-policy || true)" != volatile-ttl ]]; then
  failures+=("redis_ephemeral_memory_policy")
fi

if ! redis_cli redis INFO persistence \
  | tr -d '\r' \
  | grep -q '^aof_last_write_status:ok$'; then
  failures+=("redis_durable_persistence")
fi

for redis_workload in durable ephemeral; do
  if [[ "$redis_workload" == durable ]]; then
    redis_service="redis"
  else
    redis_service="redis-ephemeral"
  fi

  rejected_connections="$(redis_info_value "$redis_service" stats rejected_connections || true)"
  rejected_commands="$(redis_info_value "$redis_service" stats total_error_replies || true)"
  oom_commands="$(redis_error_count "$redis_service" errorstat_OOM || true)"
  fragmentation_ratio="$(redis_info_value "$redis_service" memory mem_fragmentation_ratio || true)"
  fragmentation_bytes="$(redis_info_value "$redis_service" memory mem_fragmentation_bytes || true)"

  record_redis_counter "${redis_workload}_rejected_connections" "$rejected_connections"
  record_redis_counter "${redis_workload}_rejected_commands" "$rejected_commands"
  record_redis_counter "${redis_workload}_oom_commands" "$oom_commands"

  if ! [[ "$fragmentation_ratio" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
    failures+=("redis_${redis_workload}_fragmentation_probe")
  elif ! [[ "$fragmentation_bytes" =~ ^-?[0-9]+$ ]]; then
    failures+=("redis_${redis_workload}_fragmentation_bytes_probe")
  elif awk \
    -v actual_ratio="$fragmentation_ratio" \
    -v maximum_ratio="$REDIS_FRAGMENTATION_MAX_RATIO" \
    -v actual_bytes="$fragmentation_bytes" \
    -v minimum_bytes="$REDIS_FRAGMENTATION_MIN_BYTES" \
    'BEGIN { exit !(actual_ratio > maximum_ratio && actual_bytes > minimum_bytes) }'; then
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
    "$(container_name_for_service postgres)" \
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

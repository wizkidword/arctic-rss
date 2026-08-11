#!/usr/bin/env bash
set -euo pipefail

: "${APP_DIR:?APP_DIR is required}"

RELEASE_RECORD_FILE="${RELEASE_RECORD_FILE:-$APP_DIR/.arctic-rss-release.json}"
TOPOLOGY_MANIFEST_FILE="${TOPOLOGY_MANIFEST_FILE:-$APP_DIR/ops/topologies.json}"

if [[ ! -r "$RELEASE_RECORD_FILE" ]] || [[ ! -r "$TOPOLOGY_MANIFEST_FILE" ]]; then
  echo "The active release record or topology manifest is not readable." >&2
  exit 1
fi

# The monitor consumes the same release marker the approved controller writes.
# Keep the output deliberately line-oriented and restricted to validated values
# so the caller never has to evaluate shell syntax from a JSON file.
python3 - "$RELEASE_RECORD_FILE" "$TOPOLOGY_MANIFEST_FILE" <<'PY'
import json
import os
import re
import sys

release_path, manifest_path = sys.argv[1:]
service_pattern = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*$")
project_pattern = re.compile(r"[a-z0-9][a-z0-9_-]{0,62}$")

try:
    with open(release_path, encoding="utf-8") as handle:
        release = json.load(handle)
    with open(manifest_path, encoding="utf-8") as handle:
        manifest = json.load(handle)
except (OSError, ValueError) as error:
    raise SystemExit(f"Could not read monitor topology configuration: {error}")

if release.get("schemaVersion") != 1 or manifest.get("schemaVersion") != 1:
    raise SystemExit("Unsupported release record or topology manifest schema version.")

topology_name = release.get("topology")
compose_project = release.get("composeProject")
if not isinstance(topology_name, str) or not service_pattern.fullmatch(topology_name):
    raise SystemExit("The active release record has no valid topology.")
if compose_project is None:
    # Markers from before topology-aware monitoring did not retain the Compose
    # project. Keep their established all-in-one default recoverable during a
    # rollback; controller-written markers always carry the explicit value.
    compose_project = os.environ.get("COMPOSE_PROJECT", "app")
if not isinstance(compose_project, str) or not project_pattern.fullmatch(compose_project):
    raise SystemExit("The active release record has no valid Compose project.")

topologies = manifest.get("topologies")
worker_services = manifest.get("workerServices")
if not isinstance(topologies, dict) or not isinstance(worker_services, list):
    raise SystemExit("The topology manifest is missing monitor configuration.")

topology = topologies.get(topology_name)
if not isinstance(topology, dict):
    raise SystemExit("The active release topology is not defined by the manifest.")

required_health_services = topology.get("requiredHealthServices")
required_services = topology.get("requiredServices")
chat_enabled = topology.get("chatEnabled")
if not isinstance(required_health_services, list) or not isinstance(required_services, list) or not isinstance(chat_enabled, bool):
    raise SystemExit("The selected topology has invalid monitor fields.")
if not required_health_services or any(not isinstance(service, str) or not service_pattern.fullmatch(service) for service in required_health_services):
    raise SystemExit("The selected topology has invalid required health services.")
if any(service not in required_services for service in required_health_services):
    raise SystemExit("The selected topology checks a service it does not require.")
if any(not isinstance(service, str) or not service_pattern.fullmatch(service) for service in worker_services):
    raise SystemExit("The topology manifest has invalid worker services.")

required_workers = [service for service in required_health_services if service in worker_services]
if not required_workers:
    raise SystemExit("The selected topology has no required worker modes.")

chat_gateway_enabled = "chat-gateway" in required_health_services
edge_proxy_enabled = "edge-proxy" in required_health_services
if chat_enabled != (chat_gateway_enabled and edge_proxy_enabled):
    raise SystemExit("The selected topology has inconsistent chat monitor services.")

print(f"compose_project={compose_project}")
print(f"topology={topology_name}")
print(f"chat_enabled={'true' if chat_enabled else 'false'}")
print(f"edge_proxy_enabled={'true' if edge_proxy_enabled else 'false'}")
for service in required_health_services:
    print(f"required_service={service}")
for worker in required_workers:
    print(f"required_worker_mode={worker}")
PY

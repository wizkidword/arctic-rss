#!/usr/bin/env bash
set -euo pipefail

umask 077

BACKUP_ENV_FILE="${BACKUP_ENV_FILE:-/etc/arctic-rss/backup.env}"

if (( EUID != 0 )); then
  echo "The off-host backup recorder must run as root." >&2
  exit 1
fi

if [[ ! -r "$BACKUP_ENV_FILE" ]]; then
  echo "Backup environment file is not readable." >&2
  exit 1
fi

set -a
# The file is root-controlled and may name the off-host target, but never its credentials.
# shellcheck disable=SC1090
. "$BACKUP_ENV_FILE"
set +a

: "${BACKUP_DIR:?BACKUP_DIR is required}"
: "${BACKUP_OFF_HOST_TARGET:?BACKUP_OFF_HOST_TARGET is required}"

if [[ $# -ne 1 ]] || ! [[ "$1" =~ ^20[0-9]{6}T[0-9]{6}Z$ ]]; then
  echo "Usage: $0 BACKUP_ID" >&2
  exit 1
fi

if [[ "$BACKUP_DIR" != /* ]] || [[ "$BACKUP_DIR" == "/" ]]; then
  echo "BACKUP_DIR must be a non-root absolute path." >&2
  exit 1
fi

backup_root="$(readlink -f -- "$BACKUP_DIR")"
backup_id="$1"
backup_path="$(readlink -f -- "$backup_root/$backup_id")"
case "$backup_path" in
  "$backup_root/$backup_id") ;;
  *)
    echo "Backup identifier is outside BACKUP_DIR." >&2
    exit 1
    ;;
esac

evidence_path="$backup_path/backup-evidence.json"
if [[ ! -f "$evidence_path" ]]; then
  echo "Backup evidence is missing." >&2
  exit 1
fi

python3 - "$evidence_path" "$backup_id" "$BACKUP_OFF_HOST_TARGET" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" <<'PY'
import json
import os
import stat
import sys
import tempfile

path, backup_id, target, verified_at = sys.argv[1:]
with open(path, encoding="utf-8") as handle:
    evidence = json.load(handle)
if evidence.get("schemaVersion") != 1 or evidence.get("backupId") != backup_id:
    raise SystemExit("Backup evidence does not match the requested backup.")
if not target.strip():
    raise SystemExit("Off-host target is empty.")

evidence["offHostTarget"] = target
evidence["offHostVerifiedAt"] = verified_at
mode = stat.S_IMODE(os.stat(path).st_mode)
descriptor, temporary_path = tempfile.mkstemp(prefix=".backup-evidence-", dir=os.path.dirname(path))
try:
    with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
        json.dump(evidence, handle, separators=(",", ":"), sort_keys=True)
        handle.write("\n")
        handle.flush()
        os.fsync(handle.fileno())
    os.chmod(temporary_path, mode)
    os.replace(temporary_path, path)
finally:
    if os.path.exists(temporary_path):
        os.unlink(temporary_path)
PY

printf 'BACKUP_EVIDENCE_ID=%s\n' "$backup_id"

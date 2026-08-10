#!/usr/bin/env bash
set -euo pipefail

umask 077

BACKUP_ENV_FILE="${BACKUP_ENV_FILE:-/etc/arctic-rss/backup.env}"

if [[ ! -r "$BACKUP_ENV_FILE" ]]; then
  echo "Backup environment file is not readable." >&2
  exit 1
fi

set -a
# The file is root-controlled and intentionally outside Git.
# shellcheck disable=SC1090
. "$BACKUP_ENV_FILE"
set +a

: "${BACKUP_DIR:?BACKUP_DIR is required}"

if [[ "$BACKUP_DIR" != /* ]] || [[ "$BACKUP_DIR" == "/" ]]; then
  echo "BACKUP_DIR must be a non-root absolute path." >&2
  exit 1
fi

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <named-recovery-archive> <review-by-utc-date>" >&2
  exit 1
fi

archive_name="$1"
review_by="$2"
if ! [[ "$archive_name" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$ ]] || [[ "$archive_name" =~ ^20[0-9]{6}T[0-9]{6}Z$ ]]; then
  echo "Archive name must be a named, direct backup-directory entry." >&2
  exit 1
fi
if ! [[ "$review_by" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || ! date -u -d "$review_by" +%F >/dev/null 2>&1; then
  echo "Review-by date must be a valid UTC YYYY-MM-DD value." >&2
  exit 1
fi
if [[ "$review_by" < "$(date -u +%F)" ]]; then
  echo "Review-by date must be today or later." >&2
  exit 1
fi

backup_root="$(readlink -f -- "$BACKUP_DIR")"
archive_path="$(readlink -f -- "$backup_root/$archive_name")"
case "$archive_path" in
  "$backup_root/$archive_name") ;;
  *)
    echo "Archive is outside BACKUP_DIR." >&2
    exit 1
    ;;
esac
if [[ ! -d "$archive_path" ]]; then
  echo "Named recovery archive directory does not exist." >&2
  exit 1
fi

recorded_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
manifest_path="$archive_path/.arctic-rss-archive.json"
python3 - "$manifest_path" "$archive_name" "$review_by" "$recorded_at" <<'PY'
import json
import os
import sys
import tempfile

path, archive_name, review_by, recorded_at = sys.argv[1:]
directory = os.path.dirname(path)
fd, temporary_path = tempfile.mkstemp(prefix=".arctic-rss-archive.", dir=directory, text=True)
try:
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        json.dump(
            {
                "schemaVersion": 1,
                "archiveName": archive_name,
                "recordedAt": recorded_at,
                "reviewBy": review_by,
            },
            handle,
            separators=(",", ":"),
            sort_keys=True,
        )
        handle.write("\n")
    os.chmod(temporary_path, 0o600)
    os.replace(temporary_path, path)
finally:
    try:
        os.unlink(temporary_path)
    except FileNotFoundError:
        pass
PY

echo "Registered named recovery archive review deadline."

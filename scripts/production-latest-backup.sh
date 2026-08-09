#!/usr/bin/env bash
set -euo pipefail

BACKUP_ENV_FILE="${BACKUP_ENV_FILE:-/etc/arctic-rss/backup.env}"

if [[ ! -r "$BACKUP_ENV_FILE" ]]; then
  echo "Backup environment file is not readable." >&2
  exit 1
fi

set -a
# The file is root-controlled and stores the private backup directory outside Git.
# shellcheck disable=SC1090
. "$BACKUP_ENV_FILE"
set +a

: "${BACKUP_DIR:?BACKUP_DIR is required}"

latest="$(find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d \
  -name '20??????T??????Z' -printf '%f\n' | sort | tail -n 1)"

if [[ -z "$latest" ]]; then
  echo "No completed Arctic RSS backup was found." >&2
  exit 1
fi

for file in database.dump database.catalog database.globals.sql database.dump.sha256 database.globals.sql.sha256 metadata backup-evidence.json; do
  test -s "$BACKUP_DIR/$latest/$file"
done

evidence_id="$(python3 - "$BACKUP_DIR/$latest/backup-evidence.json" "$latest" <<'PY'
import json
import re
import sys

path, expected_backup_id = sys.argv[1:]
with open(path, encoding="utf-8") as handle:
    evidence = json.load(handle)
backup_id = evidence.get("backupId")
if evidence.get("schemaVersion") != 1 or not isinstance(backup_id, str):
    raise SystemExit("Backup evidence is invalid.")
if backup_id != expected_backup_id or not re.fullmatch(r"20\d{6}T\d{6}Z", backup_id):
    raise SystemExit("Backup evidence identifier does not match the completed backup.")
print(backup_id)
PY
)"

printf '%s\n' "$evidence_id"

#!/usr/bin/env bash
set -euo pipefail

ALERT_ENV_FILE="${OPS_ALERT_ENV_FILE:-/etc/arctic-rss/alerts.env}"

if [[ ! -r "$ALERT_ENV_FILE" ]]; then
  echo "Operational alert environment file is not readable." >&2
  exit 1
fi

set -a
# The file is root-controlled and stores only operational settings kept outside Git.
# shellcheck disable=SC1090
. "$ALERT_ENV_FILE"
set +a

: "${APP_DIR:?APP_DIR is required}"
: "${OPS_ALERT_EMAIL:?OPS_ALERT_EMAIL is required}"

COMPOSE_PROJECT="${COMPOSE_PROJECT:-app}"
event_type="${1:-operational-event}"
unit_name="${2:-Arctic RSS}"

if ! [[ "$event_type" =~ ^[a-z0-9][a-z0-9._-]{0,80}$ ]]; then
  echo "Event type must be a simple identifier." >&2
  exit 1
fi

if (( ${#unit_name} > 120 )); then
  echo "Unit name is too long." >&2
  exit 1
fi

subject="Arctic RSS alert: $event_type"
body="Arctic RSS requires attention.\n\nEvent: $event_type\nSource: $unit_name\nTime (UTC): $(date -u +%Y-%m-%dT%H:%M:%SZ)\n\nCheck the production service status and logs."

cd "$APP_DIR"
docker compose -p "$COMPOSE_PROJECT" exec -T \
  -e OPS_ALERT_TO="$OPS_ALERT_EMAIL" \
  -e OPS_ALERT_SUBJECT="$subject" \
  -e OPS_ALERT_BODY="$body" \
  worker node - <<'NODE'
const nodemailer = require("nodemailer")

async function main() {
  const required = ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "OPS_ALERT_TO", "OPS_ALERT_SUBJECT", "OPS_ALERT_BODY"]
  for (const name of required) {
    if (!process.env[name]) {
      throw new Error(`${name} is required for an operational alert.`)
    }
  }

  const parsedPort = Number(process.env.SMTP_PORT ?? 587)
  const port = Number.isFinite(parsedPort) ? parsedPort : 587
  const from = process.env.SMTP_FROM?.trim() || `Arctic RSS <${process.env.SMTP_USER}>`
  const transport = nodemailer.createTransport({
    auth: { pass: process.env.SMTP_PASSWORD, user: process.env.SMTP_USER },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === "true",
    socketTimeout: 30_000,
  })

  await transport.sendMail({
    from,
    subject: process.env.OPS_ALERT_SUBJECT,
    text: process.env.OPS_ALERT_BODY,
    to: process.env.OPS_ALERT_TO,
  })
}

main().catch(() => {
  console.error("Operational alert delivery failed.")
  process.exitCode = 1
})
NODE

echo "Arctic RSS operational alert sent."

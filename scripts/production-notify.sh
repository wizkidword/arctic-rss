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
occurred_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
printf -v body 'Arctic RSS requires attention.\n\nEvent: %s\nSource: %s\nTime (UTC): %s\n\nCheck the production service status and logs.' "$event_type" "$unit_name" "$occurred_at"

cd "$APP_DIR"
send_alert() {
  docker compose -p "$COMPOSE_PROJECT" "$@" <<'NODE'
const nodemailer = require("nodemailer")

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character])
}

function renderOperationalAlertHtml({ eventType, source, occurredAt }) {
  const event = escapeHtml(eventType)
  const unit = escapeHtml(source)
  const time = escapeHtml(occurredAt)

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #dbe3ee;border-radius:12px;overflow:hidden;">
          <tr><td style="background:#0f172a;padding:24px 28px;color:#ffffff;">
            <div style="font-size:20px;font-weight:700;letter-spacing:.2px;">Arctic RSS</div>
            <div style="margin-top:4px;font-size:13px;color:#cbd5e1;">Operations alert</div>
          </td></tr>
          <tr><td style="padding:28px;">
            <div style="display:inline-block;background:#fff1f2;color:#be123c;border:1px solid #fecdd3;border-radius:999px;padding:5px 10px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;">Action needed</div>
            <h1 style="margin:18px 0 8px;font-size:24px;line-height:1.25;">Arctic RSS requires attention</h1>
            <p style="margin:0 0 22px;color:#475569;font-size:15px;line-height:1.5;">A production monitor or scheduled task reported an event that needs review.</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:8px;border-collapse:separate;overflow:hidden;font-size:14px;">
              <tr><td style="width:112px;padding:12px 14px;background:#f8fafc;color:#64748b;font-weight:700;border-bottom:1px solid #e2e8f0;">Event</td><td style="padding:12px 14px;border-bottom:1px solid #e2e8f0;word-break:break-word;">${event}</td></tr>
              <tr><td style="width:112px;padding:12px 14px;background:#f8fafc;color:#64748b;font-weight:700;border-bottom:1px solid #e2e8f0;">Source</td><td style="padding:12px 14px;border-bottom:1px solid #e2e8f0;word-break:break-word;">${unit}</td></tr>
              <tr><td style="width:112px;padding:12px 14px;background:#f8fafc;color:#64748b;font-weight:700;">Time (UTC)</td><td style="padding:12px 14px;word-break:break-word;">${time}</td></tr>
            </table>
            <div style="margin-top:22px;padding:16px;background:#eff6ff;border-left:4px solid #2563eb;border-radius:4px;">
              <div style="font-size:14px;font-weight:700;color:#1e3a8a;">Next step</div>
              <div style="margin-top:4px;font-size:14px;line-height:1.5;color:#334155;">Review the production service status and logs in OVH.</div>
            </div>
          </td></tr>
          <tr><td style="padding:18px 28px;background:#f8fafc;color:#64748b;font-size:12px;line-height:1.5;">This message was sent automatically by Arctic RSS operations monitoring.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`
}

async function main() {
  const required = ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "OPS_ALERT_TO", "OPS_ALERT_SUBJECT", "OPS_ALERT_BODY", "OPS_ALERT_EVENT", "OPS_ALERT_SOURCE", "OPS_ALERT_OCCURRED_AT"]
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
    html: renderOperationalAlertHtml({
      eventType: process.env.OPS_ALERT_EVENT,
      source: process.env.OPS_ALERT_SOURCE,
      occurredAt: process.env.OPS_ALERT_OCCURRED_AT,
    }),
    to: process.env.OPS_ALERT_TO,
  })
}

main().catch(() => {
  console.error("Operational alert delivery failed.")
  process.exitCode = 1
})
NODE
}

if ! send_alert exec -T \
  -e OPS_ALERT_TO="$OPS_ALERT_EMAIL" \
  -e OPS_ALERT_SUBJECT="$subject" \
  -e OPS_ALERT_BODY="$body" \
  -e OPS_ALERT_EVENT="$event_type" \
  -e OPS_ALERT_SOURCE="$unit_name" \
  -e OPS_ALERT_OCCURRED_AT="$occurred_at" \
  worker node -; then
  send_alert run --rm --no-deps \
    -e OPS_ALERT_TO="$OPS_ALERT_EMAIL" \
    -e OPS_ALERT_SUBJECT="$subject" \
    -e OPS_ALERT_BODY="$body" \
    -e OPS_ALERT_EVENT="$event_type" \
    -e OPS_ALERT_SOURCE="$unit_name" \
    -e OPS_ALERT_OCCURRED_AT="$occurred_at" \
    --entrypoint node worker -
fi

echo "Arctic RSS operational alert sent."

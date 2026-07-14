# Phase 12: private-beta and deployment runbook

This runbook is an approval gate, not authorization to alter the VPS. The
database migrations, room bootstrap, Compose chat profile, tunnel/proxy route,
and production environment values remain unapplied until the owner approves a
private-beta deployment window.

## Beta access control

`ARCTIC_IRC_BETA_ALLOWLIST_ENABLED=true` is effective only when
`ARCTIC_IRC_ENABLED=true`. When it is effective, every native-chat API, the
chat shell, help page, and gateway-token request require an active
`ChatBetaAccess` record. Revoked records are denied immediately; disabling the
allowlist flag returns the normal verified-account eligibility rule without
mutating user accounts or roles.

The invite list is operated only from a controlled server shell after the
reviewed migration has been applied:

```bash
npm run chat:beta -- grant --email account@example.com --note "private beta"
npm run chat:beta -- revoke --email account@example.com
```

The command deliberately does not print the email address. Each grant,
restoration, and revocation creates a `ChatAuditLog` record. Do not put invite
lists in source control, chat transcripts, or public tickets.

Guest directory access is independent. It remains unavailable unless both
native chat and `ARCTIC_IRC_GUEST_PREVIEW_ENABLED=true` are set. Signed-in beta
participants can receive private interest-based recommendations; non-invited
readers shown a guest directory receive only public room metadata.

## Repeatable loopback load test

`npm run chat:load-test` repeatedly requests a loopback-only gateway readiness
endpoint. It never sends messages, creates accounts, connects to public IRC,
or accepts a non-loopback target. Run it only against a controlled local or
VPS loopback stack after the chat-gateway health endpoint is ready.

```bash
ARCTIC_IRC_LOAD_TEST_CONFIRM=loopback-only \
ARCTIC_IRC_LOAD_TEST_CONCURRENCY=10 \
ARCTIC_IRC_LOAD_TEST_DURATION_SECONDS=30 \
npm run chat:load-test
```

Defaults are ten concurrent requests for thirty seconds against
`http://127.0.0.1:3001/ready`, with a 5-second request timeout, no failures
allowed, and a 1-second p95 limit. The script exits nonzero for a failed
request budget or p95 limit. Its compact JSON output is the record to retain
with the target hardware, Compose image IDs, concurrency, duration, p50/p95,
status counts, and date. Do not treat a local laptop result as VPS capacity
evidence.

The first beta result must be recorded by the operator; this repository has
not run the script because the chat Compose profile has deliberately not been
started.

## Production staging sequence

1. Complete [the backup and restore checklist](../operations/backup-restore-checklist.md)
   and confirm the previous release and rollback target are intact.
2. Review all additive IRC migrations, including `ChatBetaAccess`, and build
   the staged release's `migrate` image. Apply migrations only through the
   one-shot migration service; never use `prisma db push`.
3. Set the IRC feature flags in the VPS environment without printing the file.
   Keep external IRC, direct messages, room creation, guest preview, and bot
   posting disabled for the owner-only stage.
4. Bootstrap official rooms only after the migration status is current.
5. Grant beta access to the first controlled account, then start the internal
   gateway using the explicit Compose `chat` profile. The service intentionally
   has no host port mapping.
6. Add the reviewed tunnel or reverse-proxy route, test `/socket.io` WebSocket
   upgrade from the canonical browser origin, and verify that the gateway is
   unreachable from any direct public port.
7. Run the loopback load test, native-chat smoke tests, reader smoke tests,
   readiness/liveness probes, and the private-beta checklist before inviting a
   second user.

See [the existing deployment and rollback runbook](../operations/deployment-rollback-runbook.md),
[the backup checklist](../operations/backup-restore-checklist.md), and
[the CSP runbook](../operations/browser-content-security-runbook.md) for the
existing production controls.

## Gateway proxy invariants

Use the route shape selected by the deployed tunnel/proxy rather than adding a
direct gateway port. A future reviewed proxy mapping must preserve all of
these invariants:

```nginx
# Illustrative only: this is not applied production configuration.
location /socket.io/ {
  proxy_pass http://chat-gateway:3001;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_set_header Origin $http_origin;
}
```

- Forward only the canonical browser origin; the gateway rejects absent or
  mismatched origins and invalid/single-use connection tokens.
- Do not publish `3001`, bypass the managed tunnel, disable TLS, or rewrite
  `/socket.io` into an arbitrary upstream path.
- Preserve WebSocket upgrade headers, bounded request sizes/timeouts, and
  existing Host validation. Keep the existing report-only CSP observation
  period; do not move it to enforcement during the beta without review.

## Metrics, response, and rollback

Use the existing container health checks, worker heartbeat, admin queue view,
and production monitor as the beta dashboard. Record gateway readiness,
connection rejection counts, message rate-limit denials, Redis health, queue
backlog, and error rate without logging tokens, raw message bodies, emails, or
subscription lists.

The immediate chat incident control is `ARCTIC_IRC_ENABLED=false`, followed by
a controlled web/worker/gateway recreate. This removes chat routes and gateway
startup while the RSS reader stays available. For a failed code deployment,
use the existing rollback runbook; do not roll code backward across an
incompatible schema. If a migration must be reversed, restore the verified
matching backup or use a reviewed forward repair.

## Final private-beta checklist

- [ ] Owner-approved legal text and retention/deletion policy are implemented
      and verified before enabling invitations beyond the owner.
- [ ] All reviewed migrations are applied through the migration service and
      have a recorded backup/snapshot gate.
- [ ] Official rooms are bootstrapped once and verified.
- [ ] The beta allowlist has only reviewed active records.
- [ ] Gateway traffic uses the canonical WSS route; port 3001 is not public.
- [ ] External IRC flags remain false; no public IRC connection is attempted.
- [ ] Load-test result is recorded for the actual target hardware.
- [ ] Reader liveness, readiness, login, subscription refresh, and chat
      disablement have passed during a simulated gateway failure.
- [ ] Rollback target and emergency operator contacts are verified privately.

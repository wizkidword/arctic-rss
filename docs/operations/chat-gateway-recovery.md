# Chat gateway authorization and Redis recovery

This runbook covers CHAT-AUTH-001 and CHAT-REDIS-001. It is an operator guide,
not authorization to change production.

## Runtime behavior

- The web application publishes a versioned account-security event after a
  password reset, explicit session revocation, or chat beta-access revocation.
  Every gateway replica subscribes and disconnects its own matching sockets.
  Replaying an event is harmless because the local socket index is removed on
  disconnect.
- A socket authorization context contains the user and profile IDs, auth
  version, role, plan, chat eligibility, verified-email state, policy version,
  and authorization timestamp. The gateway rereads the current database state
  at least every `ARCTIC_IRC_AUTHORIZATION_MAX_AGE_SECONDS` (default 60,
  bounded 15–300). This removes access even if pub/sub delivery was missed.
- High-risk moderation HTTP routes retain their existing per-request fresh-user
  check; no cached gateway identity authorizes those routes.
- The gateway supervises separate command, Socket.IO publisher/subscriber,
  room-event, and security-event Redis clients. Reconnect delays are
  exponentially bounded and jittered; commands cannot accumulate in an offline
  queue. Room and account-security subscriptions are re-established before the
  gateway reports ready.
- During recovery `/live` remains process liveness, while `/ready` returns 503
  and new socket handshakes are rejected. If recovery exceeds
  `ARCTIC_IRC_REDIS_DEGRADED_GRACE_SECONDS` (default 90, bounded 15–600), the
  gateway closes and exits with status 1. Compose's `unless-stopped` policy then
  recreates it.

## WebSocket abuse boundaries

The gateway accepts only Cloudflare's validated `CF-Connecting-IP` header as a
client IP. Its connection rate limit is deliberately fail-closed when that
header is absent, so verify the tunnel or reverse proxy overwrites and forwards
the header before enabling chat. Never substitute `X-Forwarded-For` without a
reviewed trusted-proxy design.

Socket.IO is WebSocket-only and limits an incoming event packet to 64 KiB by
default. The gateway also enforces 5 active sockets per user, 20 per trusted
client IP, 20 rooms per socket, 8 outstanding operations per socket, and
disconnects a socket after 5 malformed events. Redis-backed limits cover
session-token requests, connection attempts, subscribe/unsubscribe, read
markers, messages, malformed events, and authorization failures. These
defaults can be adjusted only through the bounded `ARCTIC_IRC_MAX_*` variables
in `.env.example` after an approved capacity test; do not print production
values.

Malformed payloads and optional acknowledgement callbacks are safe: an absent
or failing callback cannot crash the gateway. Structured logs record counts
only, under `connection_rejected`, `malformed_event`,
`malformed_event_disconnect`, and `operation_limit_rejected`.

## Presence heartbeats

Each subscribed socket refreshes all of its current room-presence keys in one
batch every 37.5 seconds. The Redis key TTL remains 75 seconds, so a connected
user stays present through several TTL periods without creating a timer for
each room. Unsubscribe and disconnect stop or shrink the single heartbeat and
remove the relevant keys; if cleanup cannot reach Redis, the TTL is the
bounded fallback. After a gateway or Redis restart, reconnected sockets mark
their rooms and existing active sockets renew them on the next heartbeat.

The `presence_metrics` structured log has local gateway counts for active
subscriptions, active presence entries, stale-cleanup requests, and refresh
failures. A failed renewal additionally emits `presence_refresh_failed`. Log
aggregation must sum these per-replica counts; no message bodies, room names,
user IDs, tokens, or Redis URLs are logged.

## Ignored-user synchronization

Ignore records are keyed by immutable user IDs. Room-history queries exclude
blocked senders on the server, and each gateway socket loads the same ID set
before it subscribes to a room. Live room broadcasts are filtered per
recipient, so blocked content is not sent to that recipient's socket. A
versioned block-event channel updates every connected socket for the blocker;
reconnect always reloads the durable preference if a notification was missed.

Unblocking restores future content only. Previously filtered history and live
messages are not replayed automatically.

## Required release procedure

1. Use the normal approved-release procedure: clean reviewed commit, successful
   CI, image/commit recording, PostgreSQL backup verification, and retained
   rollback release. Do not use `prisma db push`; this change has no migration.
2. Build and deploy compatible web, chat-gateway, and edge-proxy images
   together. The web service publishes the event contract, the gateway
   consumes it, and the proxy preserves the canonical browser route; do not
   deploy only one side.
3. Preserve the production `.env` without displaying it. Defaults are safe, so
   the two new optional variables are only needed when a reviewed adjustment is
   required.
4. If the chat profile is active, recreate it with the approved release tool.
   It first restores healthy Redis, then recreates the gateway and edge proxy,
   followed by web and worker. Do not publish port 3001.
5. Confirm the host monitor is active. It checks a running gateway's `/ready`
   endpoint and the proxy's container health, raising the existing alert on a
   readiness transition.

## Canonical route activation

The `edge-proxy` service keeps every route on the existing web service except
`/socket.io` and `/socket.io/`, which it forwards to the internal chat gateway
with the WebSocket and `CF-Connecting-IP` headers preserved. It is always
loopback-only; do not add a direct gateway port or another public hostname.

The preferred managed-tunnel origin is `http://127.0.0.1:8080`. If the existing
managed route is fixed at port 3000 and provider permissions cannot reconcile
it, the approved release command uses a reviewed chat-topology handoff instead:
the web listener moves to loopback port 3001 and the edge proxy owns loopback
port 3000. This retains the canonical tunnel route while ensuring both reader
and Socket.IO requests traverse the proxy. Do not make this handoff manually
or apply it to a non-chat topology.

## Verification in an approved change window

Run these from the VPS without reading or echoing `.env` values:

```bash
sudo docker compose ps
sudo docker exec app-chat-gateway-1 node -e "fetch('http://127.0.0.1:3001/live').then(r => { if (!r.ok) process.exit(1) })"
sudo docker exec app-chat-gateway-1 node -e "fetch('http://127.0.0.1:3001/ready').then(r => { if (!r.ok) process.exit(1) })"
sudo docker exec app-edge-proxy-1 wget -q -O /dev/null http://127.0.0.1:8080/api/live
curl -fsS -H 'Host: CANONICAL_HOST' http://127.0.0.1:3000/api/health
sudo systemctl is-active arctic-rss-monitor.timer
```

Then use two controlled beta accounts through the canonical WSS route:

1. Connect both accounts and join a controlled room.
2. Revoke one account's chat beta access, reset its password, and use the
   administrator session-revocation control in separate checks. Each affected
   socket must close immediately; a replayed security event must not affect
   another account.
3. Demote a controlled moderator only in a restored-data or approved test
   environment. Its next high-risk HTTP moderation request must fail the fresh
   authorization check.
4. Perform the approved temporary Redis-restart exercise with the connected
   clients. While Redis is unavailable, `/ready` must fail and a new connection
   must be rejected. After recovery, `/ready` must succeed, subscriptions must
   receive a room message, and a new client must connect without manual repair.
5. If recovery is intentionally held past the grace period, verify that the
   gateway exits, Compose restarts it, and the host monitor records the
   readiness failure and recovery. Do not perform this destructive test during
   a user-facing window.
6. Confirm one controlled account can use multiple normal tabs while the
   configured socket cap rejects the next connection, then close a tab and
   confirm a new connection succeeds. Run any connection-flood or oversized
   payload exercise only against an approved non-production gateway.
7. Keep a controlled socket subscribed for more than 75 seconds and confirm it
   remains present. Then unsubscribe and disconnect it separately; verify the
   `presence_metrics` count returns to baseline and no further refresh occurs.

Relevant structured log event names are `redis_degraded`, `redis_ready`,
`redis_recovery_exhausted`, `security_disconnect`,
`stale_authorization_rejected`, and
`chat_account_security_event_publish_failed`. They contain counts and reasons,
including active sockets, sockets per connected user, forced disconnects,
reconnects, and required subscriber channels, never tokens, raw messages, or
Redis URLs.

## Rollback and forward repair

This work introduces no migration and leaves the event channel versioned.
Retain the prior app directory and images as normal. If the release fails,
restore the prior compatible web and gateway images together, recreate only
those application services, and verify `/live`, `/ready`, canonical login, and
the controlled chat smoke test. If a failed event publish or a missed event is
observed, keep the new code running when possible: the bounded fresh
authorization check is the safe forward-repair path.

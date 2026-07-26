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

## Required release procedure

1. Use the normal approved-release procedure: clean reviewed commit, successful
   CI, image/commit recording, PostgreSQL backup verification, and retained
   rollback release. Do not use `prisma db push`; this change has no migration.
2. Build and deploy compatible web and chat-gateway images together. The web
   service publishes the event contract and the gateway consumes it; do not
   deploy only one side.
3. Preserve the production `.env` without displaying it. Defaults are safe, so
   the two new optional variables are only needed when a reviewed adjustment is
   required.
4. If the chat profile is active, recreate it with the approved release tool.
   It first restores healthy Redis, then recreates the gateway, followed by web
   and worker. Do not manually replace the tunnel or publish port 3001.
5. Confirm the host monitor is active. It now checks a running gateway's
   `/ready` endpoint and raises the existing alert on a readiness transition.

## Verification in an approved change window

Run these from the VPS without reading or echoing `.env` values:

```bash
sudo docker compose ps
sudo docker exec app-chat-gateway-1 node -e "fetch('http://127.0.0.1:3001/live').then(r => { if (!r.ok) process.exit(1) })"
sudo docker exec app-chat-gateway-1 node -e "fetch('http://127.0.0.1:3001/ready').then(r => { if (!r.ok) process.exit(1) })"
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

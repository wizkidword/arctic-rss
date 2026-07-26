# Arctic RSS second-pass baseline

This is an internal, secret-safe baseline for the second remediation pass. It
records observations made before changing the first two findings; it does not
authorize a production deployment.

## Repository baseline

- Reviewed source commit: `fd3d5ec3d06d3afe9f75a7e2b13ab05a75909e58` on
  `main`, matching `origin/main`, with a clean worktree before this change.
- Local runtime at review: Node `v20.19.0`, npm `10.8.2`; runtime images use
  Node 24 Alpine.
- The Compose topology contains `web`, `worker`, `postgres`, `redis`, the
  one-shot `migrate` service, and the opt-in `chat-gateway` profile. The
  gateway has no host port mapping.
- The current release script builds the gateway with the app services, keeps
  the existing environment file secret, applies reviewed migrations through
  the controlled migration service, then recreates a gateway that was already
  running after Redis is healthy.

## Read-only VPS baseline

- The live app directory is an archive deployment rather than a Git checkout.
  The private release record identifies the live source as `fd3d5ec` and its
  verified backup as `20260723T190848Z`; a newer nonempty backup was present
  during this review.
- `web`, `worker`, `chat-gateway`, PostgreSQL, and Redis were healthy. Web,
  PostgreSQL, and Redis host bindings were loopback-only; the gateway had no
  host binding. The separately managed Cloudflare connector was running.
- The production environment file was root-owned and mode `0600`. Its contents
  were not read or copied.
- The existing host monitor and timer were active and successful. It previously
  checked the web, worker, database, Redis, backups, public readiness, and
  persistence, but did not probe a running gateway's readiness.

## Findings revalidated

### CHAT-AUTH-001

The gateway checked token, account, role, plan, email, and profile state only
when accepting a socket. It retained only a minimal identity for the socket,
had no user-to-socket index, and did not subscribe to account-security events.
HTTP moderation routes already call `requireChatEligibleUser`, which obtains a
fresh database user on each request; the socket path was the missing control.

### CHAT-REDIS-001

The gateway command, Socket.IO-adapter, and room-event clients were configured
with reconnect disabled. A Redis interruption therefore left an otherwise live
process without a recovery path. `/ready` did test a Redis command client, but
the Compose healthcheck used `/live`, so the deployment and host monitor could
miss the degraded gateway state.

## Deployment boundary

No VPS mutation, backup creation, migration, environment edit, proxy edit, or
service restart was performed while creating this baseline. Use the approved
release command and the gateway recovery runbook after the repository gate and
an explicit production approval.

# Redis credential and network rollout

## Status: source support only

This runbook describes the owner-gated production rollout for the separate
durable and ephemeral Redis ACL credentials and Compose networks. No production
credential was read, created, rotated, or deployed while this source change was
implemented.

## What changes in a future approved rollout

The root-only environment file must contain these distinct values, without
printing them:

- `DURABLE_REDIS_USERNAME`, `DURABLE_REDIS_PASSWORD`, and
  `DURABLE_REDIS_URL` for `redis`.
- `EPHEMERAL_REDIS_USERNAME`, `EPHEMERAL_REDIS_PASSWORD`, and
  `EPHEMERAL_REDIS_URL` for `redis-ephemeral`.

Each URL must use the matching ACL username and URL-encoded password. The
application will refuse matching durable/ephemeral endpoints, ACL usernames,
or passwords in normal production. The Compose topology separately limits the
durable-only workers to `durable-data`, keeps the chat gateway off that network,
and gives web plus the chat-event worker access to both Redis networks.

The Redis ports remain bound only to loopback. Network separation is not a
substitute for the existing firewall and host-access controls.

## Compatibility boundary

`REDIS_URL` and `ARCTIC_RSS_ALLOW_LEGACY_REDIS_URL_FOR_MIGRATION` are a
temporary direct-process compatibility path described in
[the retirement runbook](legacy-redis-compatibility-retirement.md). They are
not supplied to normal Compose services and must not be used to recreate a
shared credential. Once Redis starts with the new ACL configuration, its
default user is disabled, so the old default-user URL cannot provide a silent
fallback.

Use that compatibility path only when a reviewed, time-bounded recovery
requires the pre-ACL deployment state. It is never an authorization to deploy,
rotate credentials, or bypass the approved release procedure.

## Owner-gated rollout checklist

1. Obtain a fresh production-readiness approval and a release approval for the
   selected immutable revision. CI success alone is not approval.
2. On OVH, verify by variable name only that the six new Redis inputs are
   present, non-empty, and distinct where required. Do not print their values.
3. Render the staged Compose configuration and run its source gates:
   `npm run compose:verify-env`, `npm run compose:verify-dependencies`,
   `npm run compose:verify-redis-boundaries`, and
   `npm run redis:boundaries:verify`.
4. Apply the approved release through the standard immutable-image procedure.
   Do not edit a failed attempt, daemon-reload, or retry it without the next
   explicit authorization.
5. Verify public health, protected diagnostics, login, the selected worker
   heartbeats, durable queue work, and chat transport as applicable. Record
   only variable names and pass/fail results, never credentials.
6. Confirm that the chat gateway cannot resolve durable Redis and that a
   durable-only worker cannot resolve ephemeral Redis from the rendered/running
   topology. The CI integration gate covers the same negative cases locally.

## Retirement checklist

After an approved release has run stably with ACL users and separate networks:

1. Confirm by variable name only that no production application service
   receives `REDIS_URL` or the legacy migration flag.
2. Confirm the default Redis ACL user remains disabled and the workload URLs
   authenticate only with their matching ACL users.
3. Obtain a new explicit approval to remove the compatibility code and example
   variables.
4. Remove the compatibility path, its tests, and its allowlisted documentation
   in one reviewed source change; then run the full release and post-release
   checks again.

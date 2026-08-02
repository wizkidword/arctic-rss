# Arctic RSS Phase 4B — readiness and diagnostics

## Status

Implemented locally; not deployed. This milestone follows the published Phase
4A Redis-separation change. No VPS, production environment file, backup,
runtime service, or deployment command was accessed.

## Implemented readiness signals

- Public `/api/health` remains a two-state, non-cacheable response with no
  dependency detail.
- Internal readiness independently checks PostgreSQL, durable Redis, ephemeral
  Redis, topology-required worker heartbeats, a successful maintenance tick,
  bounded queue lag/stall/recent-failure conditions, and the chat gateway only
  for chat-enabled topologies.
- Workers now retain the local Compose heartbeat and also publish durable
  Redis TTL records containing mode, instance ID, release SHA, and timestamp.
  A stopped or wedged container expires from the durable view within 90
  seconds.
- The maintenance owner records a second durable timestamp only after all of
  its bounded scheduler operations succeed under the renewable lease.
- The approved release and rollback tools pass the manifest-selected topology
  and exact commit SHA to Compose. Production web validation rejects an absent
  or unknown topology.
- `npm run doctor` supplies a redacted operator report with topology, variable
  presence, secret-boundary result, database roles, Redis separation, migration
  status, heartbeat/tick age, queue readiness, chat readiness, and optional
  backup-metadata age.

## Verification performed

- Focused readiness/doctor/production-security/worker tests pass locally.
- TypeScript checking passes locally.
- The local `npm run doctor` run exits nonzero with a redacted unavailable
  report because this project checkout has no configured local Redis or
  application service. No secret values were displayed.

## Remaining release gate

Run the full test, lint, build, Compose environment, and topology validation
gates before publication. A production deployment remains prohibited until a
fresh typed `DEPLOY <short-sha>` approval is supplied for the reviewed commit.

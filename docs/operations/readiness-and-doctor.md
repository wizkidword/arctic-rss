# Readiness and redacted diagnostics

## Public health

`GET /api/health` is public-safe and returns only one of:

```json
{"status":"ok"}
```

```json
{"status":"degraded"}
```

It never returns dependency names, worker names, queue contents, timestamps,
credentials, URLs, or raw error messages.

The dedicated `worker-health` role runs the deep dependency inspection every
20 seconds under the existing durable maintenance lease. It writes one compact,
versioned snapshot to durable Redis with a 60-second TTL. Every web replica
performs only a bounded 250-millisecond Redis read; it never starts PostgreSQL,
queue, worker, or chat diagnostics and never constructs a BullMQ queue. A
missing, malformed, expired, or older-than-45-second snapshot is `degraded`.
This keeps a public-probe burst to lightweight shared-record reads rather than
multiplied diagnostics.

Trusted `cf-connecting-ip` values are rate-limited at 600 requests per minute.
Requests without a valid trusted client IP are not rejected, so loopback and
load-balancer probes remain usable. Every public result is `no-store`; the
shared snapshot is private durable-Redis state rather than a public
intermediary cache.

The application writes low-cardinality structured events for public request
snapshot source and age plus health-worker snapshot outcome and duration. It
does not log client IPs, URLs, secrets, or raw dependency errors.

Docker uses `/api/live` for cheap web-process liveness. Public health is the
cached dependency-aware signal; it returns HTTP 200 only for `ok` and a
non-200 status otherwise.

## Detailed health

`GET /api/internal/health` is protected by fresh administrator authorization.
Ordinary unauthenticated and non-administrator requests receive a 403 response.
A successful response is `no-store` and performs an explicit fresh diagnostic,
returning sanitized check names and check duration:

- PostgreSQL, durable Redis, and ephemeral Redis;
- required worker heartbeats and maintenance freshness;
- bounded queue readiness; and
- chat gateway readiness only for a chat-enabled topology.

Feed and podcast refresh jobs remove both successful and terminally failed
BullMQ jobs so a permanent source job ID cannot block its next legitimate
refresh. Terminal source failures still write existing per-source database
diagnostics and a bounded durable Redis list containing only the refresh kind
and timestamp. Queue readiness uses that compact recent-failure evidence rather
than retained source job records; it never exposes source IDs, job IDs, queue
payloads, or raw errors.

The detailed route does not return credentials, connection strings, queue
payloads, job IDs, or raw dependency errors. Unlike public health, it is an
intentional administrator diagnostic and may run the bounded deep checks.

Workers keep the existing container-local `/tmp` heartbeat for Docker. They
also refresh a 90-second durable Redis TTL record containing only worker mode,
container instance ID, release SHA (or `unknown` outside the release command),
and a timestamp. The single selected mode owner makes a stale record a
cross-container signal without putting health state in a local filesystem.

The local heartbeat is written only after its durable Redis write succeeds.
Long-lived worker control-plane clients reconnect with bounded jitter. During a
durable Redis outage, a worker stops refreshing its local health file and a
maintenance pass loses its lease before it can make another lease-protected
write. `WORKER_CONTROL_PLANE_RECOVERY_GRACE_MS` defaults to 60 seconds and is
accepted only from 10 seconds through 10 minutes; if recovery does not finish
inside that window, the worker shuts down with a nonzero exit so Compose can
replace it. The state logs contain only the control-plane client label and
state, never a Redis URL, credential, queue payload, or raw error.

The approved release and rollback scripts inject the manifest-selected topology
and commit SHA into Compose. Manual production Compose use must set
`ARCTIC_RSS_TOPOLOGY` to one of the names in
[`ops/topologies.json`](../../ops/topologies.json); production web startup
rejects an absent or unknown value. The health worker requires that same
topology value so it can verify the exact selected worker set.

## `npm run doctor`

Doctor has explicit scopes. It emits a redacted JSON `report` plus a central
`evaluation` array. Every evaluation entry is `OK`, `WARNING`, `FAILURE`,
or `NOT_APPLICABLE`; the process exit code is derived from those entries, not
from a hand-picked subset.

```bash
npm run doctor -- runtime --role web
npm run doctor -- runtime --role worker-ingestion
npm run doctor -- host
npm run doctor -- migrations
npm run doctor -- release --topology split-with-chat
```

- `runtime` checks only the selected service role's required variables and
  runtime dependencies.
- `host` validates structured backup evidence and the real Redis server identities.
- `migrations` checks the migration status using the migration-only
  credential boundary.
- `release` aggregates runtime, host, and migration checks for the selected
  topology.

Exit code 0 means every required check passed. Exit code 1 means at least one
required check failed or could not be evaluated. `--warn-only` is available
only for exploratory use: it leaves failures visible in the JSON but suppresses
exit-code enforcement. It is not a release approval.

Doctor reports present/missing variable names, not values; runtime and migration
database role names, not connection strings; selected topology, worker
ownership, heartbeat and tick ages, queue thresholds, chat readiness, and only
the backup-evidence result plus its backup/restore ages. It never prints
environment values, credentials, queue payloads, job IDs, backup paths,
off-host targets, checksums, backup contents, or Redis server IDs.

The host backup check requires a supported machine-readable record for the
expected production database and environment. It rejects a missing or malformed
record; future or stale backup time; absent, empty, resized, or checksum-altered
artifact; missing off-host acknowledgement; and a missing or stale restore
drill. The policy and private stable evidence path are documented in the
[backup and restore checklist](backup-restore-checklist.md).

Host diagnostics compare both the normalized Redis endpoints and live Redis
server identities. The report distinguishes:

- the same endpoint;
- aliases for the same server and database;
- the same server with different logical databases; and
- separate Redis servers.

Arctic RSS requires separate durable and ephemeral Redis servers in production.
A shared server is a host-diagnostic failure even when the logical databases
differ. An unavailable endpoint is also a failure in enforcing host and release
scopes.

For a production release, retain the existing fresh typed
`DEPLOY <short-sha>` gate and the release/rollback runbook. CI, health, and
doctor results are diagnostic evidence; none authorizes a deployment.

# Readiness and redacted diagnostics

## Public health

`GET /api/health` is public-safe and returns only one of:

```json
{"status":"ok"}
```

```json
{"status":"degraded"}
```

```json
{"status":"unavailable"}
```

It never returns dependency names, worker names, queue contents, timestamps,
credentials, URLs, or raw error messages.

The application keeps a process-local health snapshot for three seconds. One
refresh is shared by concurrent cache misses. When an expired snapshot is less
than 30 seconds old, it is served while one refresh runs; once it is older, a
request waits for the next bounded refresh. A failed refresh returns
`unavailable`. This prevents a burst of public probes from multiplying
PostgreSQL, Redis, queue, worker, or chat checks.

Trusted `cf-connecting-ip` values are rate-limited at 600 requests per minute.
Requests without a valid trusted client IP are not rejected, so loopback and
load-balancer probes remain usable. Every public result is `no-store`; the
short cache is inside the application, rather than a public intermediary.

The application writes low-cardinality structured events for public request
snapshot source and age, refresh duration and classification, and suppressed
concurrent refreshes. It does not log client IPs, URLs, secrets, or raw
dependency errors.

Docker uses `/api/live` for cheap web-process liveness. Public health is the
cached dependency-aware signal; it returns HTTP 200 only for `ok` and a
non-200 status otherwise.

## Detailed health

`GET /api/internal/health` is protected by fresh administrator authorization.
Ordinary unauthenticated and non-administrator requests receive a 403 response.
A successful response is `no-store` and includes the current detailed checks,
the snapshot age, and check duration:

- PostgreSQL, durable Redis, and ephemeral Redis;
- required worker heartbeats and maintenance freshness;
- bounded queue readiness; and
- chat gateway readiness only for a chat-enabled topology.

The detailed route does not return credentials, connection strings, queue
payloads, job IDs, or raw dependency errors. It uses the same single-flight
refresh as public health, so an operator refresh cannot create a duplicate
concurrent diagnostic run.

Workers keep the existing container-local `/tmp` heartbeat for Docker. They
also refresh a 90-second durable Redis TTL record containing only worker mode,
container instance ID, release SHA (or `unknown` outside the release command),
and a timestamp. The single selected mode owner makes a stale record a
cross-container signal without putting health state in a local filesystem.

The approved release and rollback scripts inject the manifest-selected topology
and commit SHA into Compose. Manual production Compose use must set
`ARCTIC_RSS_TOPOLOGY` to one of the names in
[`ops/topologies.json`](../../ops/topologies.json); production web startup
rejects an absent or unknown value.

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
- `host` checks backup-metadata evidence and the real Redis server identities.
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
ownership, heartbeat and tick ages, queue thresholds, and chat readiness. It
never prints environment values, credentials, queue payloads, job IDs, backup
contents, or Redis server IDs.

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

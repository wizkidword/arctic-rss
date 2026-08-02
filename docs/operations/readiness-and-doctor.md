# Readiness and redacted diagnostics

`GET /api/health` is deliberately public-safe. It returns only one of:

```json
{"status":"ok"}
```

or:

```json
{"status":"degraded"}
```

It does not return endpoint names, worker names, queue contents, timestamps,
credentials, URLs, or error messages. Docker uses `/api/live` for a cheap web
process liveness check; readiness is the stricter, dependency-aware signal.

## Internal readiness contract

For the topology selected in `ARCTIC_RSS_TOPOLOGY`, readiness checks:

- PostgreSQL, durable Redis, and ephemeral Redis independently;
- every worker mode required by that topology, using a durable Redis heartbeat;
- the last fully successful maintenance scheduler tick;
- bounded BullMQ queue metadata: oldest waiting work, active jobs that exceed
  the stall threshold, and recent failed-job count; and
- the chat gateway `/ready` endpoint only when the selected topology enables
  chat.

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

Queue readiness is intentionally bounded: waiting and active reads do not scan
all jobs, a suspected stall is an active job older than 15 minutes, and more
than five failed jobs in the most recent 15 minutes degrades readiness. These
limits are operational alerts, not a command to delete or retry work.

## `npm run doctor`

Run the doctor command inside a reviewed runtime environment:

```bash
npm run doctor
```

It emits JSON containing only safe metadata:

- present/missing variable names for the current service role;
- production configuration-boundary validation errors with URLs redacted;
- Redis separation result, runtime/migration database role names, and migration
  status without connection strings;
- selected topology, worker ownership modes, heartbeat/tick ages, queue counts
  and thresholds, and chat readiness;
- optional backup-metadata age, read from `ARCTIC_RSS_BACKUP_METADATA_PATH`
  when that safe metadata file is mounted or supplied to the process.

It never prints environment values, connection strings, secret values, queue
payloads, job IDs, or backup contents. A nonzero exit means a required
readiness or production-boundary check failed; it is diagnostic evidence, not
deployment authorization. On a workstation with no configured local services,
an unavailable report is expected.

For a production release, retain the existing fresh typed
`DEPLOY <short-sha>` gate and the release/rollback runbook. CI and doctor
results do not authorize a deployment.

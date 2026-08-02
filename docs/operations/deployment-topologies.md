# Supported deployment topologies

[`ops/topologies.json`](../../ops/topologies.json) is the canonical,
machine-readable definition of Arctic RSS deployment topology. It defines the
profiles, required services, worker ownership, Redis workloads, environment
requirements, health checks, and release/rollback service lists. Do not copy a
service list into a release command without checking it against that file.

Validate the manifest and its service names against the rendered Compose
configuration before changing topology:

```bash
npm run topology:validate
```

The command renders Compose with `.env.example`; it never reads a production
environment file or starts containers. CI runs the same validator for the two
chat-enabled topologies and verifies the services actually running in each
matrix job.

## Topology selection

| Topology | Compose profiles | Worker ownership | Chat services |
| --- | --- | --- | --- |
| `all-in-one` | `all-in-one` | `worker` owns every worker responsibility | Off |
| `all-in-one-with-chat` | `all-in-one`, `chat` | `worker` owns every worker responsibility | gateway and edge proxy |
| `split` | `split-workers` | ingestion, AI/mail, imports, and maintenance each have one worker | Off |
| `split-with-chat` | `split-workers`, `chat-workers`, `chat` | split workers plus one chat-events worker | gateway and edge proxy |

The optional tunnel overlay adds the `tunnel` profile, `cloudflared`, and
`CLOUDFLARE_TUNNEL_TOKEN` to any selected topology. It does not decide whether
chat is enabled.

`worker` is behind the explicit `all-in-one` profile and is not part of the
default `docker compose up`. `worker-chat-events` is behind the explicit
`chat-workers` profile, so non-chat split deployments do not start a worker
that owns chat outbox work. Never activate `all-in-one` together with either
split-worker profile.

## Operator requirements

- Choose exactly one named topology before release, rollback, or diagnostics.
- Include its complete profile set in every Compose command.
- Run migrations only through the unprofiled `migrate` service.
- Recreate the topology's `releaseServices` list together; use its
  `rollbackServices` list for a code rollback.
- Confirm the topology's required health services before public verification.
- Add a service, profile, or worker responsibility first to
  `ops/topologies.json`, then update Compose and run `npm run topology:validate`.

The approval-gated Windows release and rollback procedures consume these
selected service lists directly. A rollback selects the prior topology stored
in its private release record and is still a separately approved production
action; this document does not authorize a topology cutover.

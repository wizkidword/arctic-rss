# Fifth-pass Phase 8 — Redis ACL and chat-role evidence

**Recorded:** 2026-08-10
**Scope:** source, disposable loopback Redis/PostgreSQL, and CI configuration
**Production status:** not deployed or operator-verified

## Redis command inventory and tested paths

| Workload | Required command path | Local proof |
| --- | --- | --- |
| Durable BullMQ producer and worker | BullMQ's normal producer/worker lifecycle and its library-managed Lua scripts; `INFO` is required by the normal BullMQ readiness check. | A real `Queue` added one job and a real `Worker` completed it with the restricted durable user. |
| Worker heartbeat and maintenance lease | Heartbeat `SET PX` and `MGET`; lease `SET PX NX`; ownership-checked Lua `GET`/`PEXPIRE` renew and `GET`/`DEL` release. | The disposable durable client wrote/read a heartbeat, acquired, renewed, and released an owned lease. |
| Health snapshot | `SET PX` and `GET`. | The compact versioned snapshot write/read path completed against durable Redis. |
| Source failure evidence | `LPUSH`, `LTRIM`, and `LRANGE`. | A compact terminal source failure was retained and read back from the bounded list. |
| Rate limiting | Lua `INCR`, first-write `PEXPIRE`, and `PTTL`. | The rate-limit counter returned its first count and a positive TTL on ephemeral Redis. |
| Chat presence and replay | Presence `SET EX`, `GET`, and `DEL`; event `SUBSCRIBE` and `PUBLISH`. | The fixture persisted/cleared a presence record and delivered a real room-event channel message. |
| Socket.IO Redis adapter | Pattern and direct subscriptions plus `PUBSUB NUMSUB`. | A real Socket.IO Redis adapter reached a ready subscription count using restricted ephemeral clients. |

The application ACL policy is `+@all -@admin -@dangerous +info`, with the
default Redis user disabled. `INFO` is the one explicit re-grant: BullMQ's
normal readiness behavior demonstrably requires it. The integration gate
denies `ACL`, `CONFIG`, `FLUSHALL`, `FLUSHDB`, `MODULE`, `REPLICAOF`, and
`SHUTDOWN` to both application users, rejects cross-workload credentials, and
proves that the durable and ephemeral fixture networks cannot resolve one
another's Redis host.

Compose uses that same policy for both Redis services, and its rendered-boundary
check fails if the ACL deny/re-grant sequence or disabled default user drifts.

## Restricted chat database role

`npm run db:verify-chat-role` created a disposable loopback PostgreSQL 17.10
container, applied all 51 committed migrations as the schema owner, applied the
chat-role bootstrap twice, and connected as `arctic_chat`. The restricted role
completed authorization revalidation, a room snapshot, normal-message plus
outbox creation, and a read-marker update. It was denied article bodies,
password/reset/deletion tokens, AI data, user plan/role changes, broad chat
reports, and schema DDL.

The Compose-backed chat release workflow now follows the same ordering for both
chat topologies: migrate first, bootstrap `arctic_chat` twice, then start the
web, worker, gateway, and edge services with `CHAT_DATABASE_URL` assigned to
that restricted role. Its existing readiness, ephemeral-Redis restart,
durable-Redis worker recovery, and chat release-gate steps therefore no longer
run the gateway as the PostgreSQL superuser. This is CI configuration and local
role evidence, not a claim that a new remote CI run or production deployment
has completed.

## Runtime configuration boundary

The generated service-role manifest no longer permits legacy `REDIS_URL` or its
migration flag in the chat gateway, which always needs an explicit ephemeral
Redis ACL URL. Production-startup tests now inject every managed variable and
compatibility alias into every ineligible role, and assert endpoint, ACL
username, and password separation for web, all-in-one workers, chat-event
workers, and health workers.

## Verification performed

- `npm run redis:boundaries:verify` — passed.
- `npm run compose:verify-redis-boundaries` — passed.
- `npm run compose:verify-env` — passed.
- `npm run compatibility:verify-legacy-redis` — passed.
- `npm run db:verify-chat-role` — passed on a clean rerun.
- `npm run test:chat:release-gates` — passed: 18 files and 114 tests.
- Focused production-security and service-role-manifest tests, `npm run lint`,
  `npm run typecheck`, and `git diff --check` — passed.

No production Redis credential, PostgreSQL credential, account data, container,
network, deployment, SSH session, release, or public endpoint was used or
changed. A future release still requires current production evidence and a
fresh exact `DEPLOY <short-sha>` approval.

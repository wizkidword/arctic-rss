# Service secret matrix

Docker Compose reads `.env` only to interpolate the explicit `environment:`
allowlists in `docker-compose.yml`. It must never inject the entire file into a
service with `env_file`.

The exact, machine-readable source of truth is
[`config/service-role-environments.json`](../../config/service-role-environments.json).
It lists every allowed and required variable for every application role plus
the environment set for each infrastructure service. Compose validation, doctor
required-variable output, and production startup checks consume that source.

## Runtime matrix

| Service | Required configuration | Explicitly excluded examples |
| --- | --- | --- |
| `migrate` | `DATABASE_URL`, interpolated from `MIGRATE_DATABASE_URL` | Runtime DB URL, auth, mail, AI, chat, and tunnel values |
| `web` | Runtime DB, durable/ephemeral Redis URLs, auth/origin/cron, optional Google, SMTP, Turnstile, AI, and web chat settings | `MIGRATE_DATABASE_URL`, `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, tunnel token |
| `worker` (`all`) | Runtime DB, both Redis URLs, feed/scheduler settings, optional AI/mail, and required chat-worker settings | Runtime auth/OAuth, Turnstile, migration, PostgreSQL/Redis container passwords, tunnel token |
| `worker-ingestion` | Runtime DB, durable Redis, feed/podcast concurrency, chat bot flags | OAuth, SMTP, AI, Turnstile, ephemeral Redis, migration, tunnel values |
| `worker-ai-mail` | Runtime DB, durable Redis, origin, optional AI and SMTP configuration | OAuth, Turnstile, chat token, migration, tunnel values |
| `worker-imports` | Runtime DB and durable Redis | Auth/OAuth, SMTP, AI, chat, migration, tunnel values |
| `worker-maintenance` | Runtime DB, durable Redis, scheduler/monitor and chat-retention settings | Auth/OAuth, SMTP, AI, chat token, migration, tunnel values |
| `worker-chat-events` | Runtime DB, durable/ephemeral Redis, event-outbox interval | Auth/OAuth, SMTP, AI, chat token, migration, tunnel values |
| `chat-gateway` | Runtime DB, ephemeral Redis, canonical origin, chat token and gateway limits | Auth/OAuth, SMTP, AI, migration, PostgreSQL/Redis container passwords, tunnel token |
| `cloudflared` | `TUNNEL_TOKEN`, interpolated from `CLOUDFLARE_TUNNEL_TOKEN` | Database, Redis, auth, SMTP, AI, and chat values |

`postgres`, `redis`, and `redis-ephemeral` receive only the database/Redis
container settings needed to boot their own process. Application connection
URLs are never given to those infrastructure containers.

## Validation and rotation

- `npm run compose:verify-env` renders all supported Compose profiles from
  `.env.example` and fails if any service has a missing or unexpected variable
  relative to the exact manifest. Its output contains names only, never values.
- Production web, worker, and chat-gateway startup validates its own role and
  rejects sensitive variables that do not belong there.
- Rotate a credential only in the services that receive it. For example,
  rotating `OPENAI_API_KEY` affects web plus `worker`/`worker-ai-mail`; a
  chat-token rotation affects web plus `chat-gateway`; a tunnel-token rotation
  affects only `cloudflared`.

## Adding a variable

1. Trace its runtime read and assign it to the smallest service set.
2. Add it to that service's explicit Compose allowlist and the exact manifest.
3. Run `npm run compose:verify-env`; do not weaken it to an absence-only check.
4. Add role-validation coverage if a production process reads it at startup.
5. Do not restore `env_file` as a compatibility shortcut.

## Emergency rollback only

`ops/compose/emergency-env-file.override.yml` is a dormant, value-free
compatibility override for an owner-approved rollback. It restores the former
broad injection only when explicitly passed to Docker Compose. It is not part
of normal launch, release, CI, or rollback commands and must be removed after
one stable release confirms the allowlists.

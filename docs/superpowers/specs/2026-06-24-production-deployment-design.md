# Milestone 11 Production Deployment Design

## Source And Goal

The Arctic RSS project plan defines Milestone 11 as:

- Dockerfile
- Docker Compose with web, worker, PostgreSQL, Redis, and cloudflared
- PostgreSQL container or external `DATABASE_URL`
- Production environment variables
- Cloudflare Tunnel setup notes
- Deployment documentation

The acceptance criteria are that Arctic RSS runs locally with Docker Compose,
runs on a VPS or home server, can be exposed through Cloudflare Tunnel, and has
clear setup documentation.

This repository already has a working standalone Next.js image, worker image,
PostgreSQL, Redis, a one-shot schema synchronization container, and an optional
token-based `cloudflared` profile. Milestone 11 hardens and validates that
foundation rather than replacing it.

## Deployment Modes

### Current Tavern Cellar Host

The current Windows host uses the existing locally-managed named tunnel:

- Tunnel: `arctic-tavern-prod`
- Tunnel ID: `bf50505d-96e9-4027-a121-d53fa66988d7`
- Config: `C:\Users\Elwynn\.cloudflared\config.yml`
- Arctic RSS origin: `http://localhost:3003`
- Public hostname: `https://arcticrss.taverncellar.com`

The existing `watch.taverncellar.com` and `erp.taverncellar.com` ingress rules
must remain unchanged. Arctic RSS is inserted before the final
`http_status:404` catch-all rule. DNS is routed to the same named tunnel.

The host-managed tunnel is intentionally not moved into this application's
Compose stack because it already serves other applications and its credential
file must remain outside the repository.

### Portable Self-Hosted Deployment

Other operators can use the Compose `tunnel` profile with a remotely-managed
tunnel token. In that mode, the Cloudflare dashboard maps a public hostname to
`http://web:3000`, and `CLOUDFLARE_TUNNEL_TOKEN` is supplied only through the
untracked runtime environment.

Operators may omit the profile and use any reverse proxy or an external
`cloudflared` process instead.

## Health And Readiness

Add `GET /api/health`, returning:

```json
{
  "status": "ok",
  "checks": {
    "database": "ok",
    "redis": "ok"
  }
}
```

The handler checks PostgreSQL through Prisma and Redis through the existing
BullMQ feed-refresh queue. It returns HTTP `503` with generic failed check
states when a dependency is unavailable. Internal connection details and raw
errors are never returned.

The web container healthcheck calls this endpoint from inside the container.
PostgreSQL and Redis retain their existing native healthchecks. The worker's
main process remains Docker's liveness signal while its queue state is visible
from the admin dashboard.

## Compose Hardening

- Bind web, PostgreSQL, and Redis host ports to `127.0.0.1`.
- Keep service-to-service traffic on the private Compose network.
- Make PostgreSQL database, user, and password configurable with development
  defaults for backward compatibility.
- Add web health status and require cloudflared to wait for web health.
- Pin the optional cloudflared image to the current stable `2026.6.1` release.
- Keep persistent named volumes and `unless-stopped` restart policies.
- Keep `prisma db push` for this MVP because the repository has no migration
  history yet. The deployment guide states that a future migration baseline is
  required before switching to `prisma migrate deploy`.

## Production Environment

The example environment distinguishes public URL settings from internal
service URLs:

- `AUTH_URL` and `NEXTAUTH_URL` use the public HTTPS hostname.
- `NEXT_PUBLIC_APP_URL` uses the public HTTPS hostname.
- `AUTH_TRUST_HOST=true` allows the trusted reverse proxy headers.
- `DATABASE_URL` and `REDIS_URL` use Compose service names.
- `AUTH_SECRET`, `CRON_SECRET`, database password, API keys, and tunnel token
  are generated secrets and never committed.

For the current Tavern Cellar deployment, the active `.env` public URL values
are updated to `https://arcticrss.taverncellar.com`.

## Documentation

`DEPLOYMENT.md` covers:

- Windows home-server deployment using the existing named tunnel
- Generic Linux/VPS Docker deployment
- Optional token-based cloudflared profile
- External PostgreSQL and Redis overrides
- Environment and secret generation
- Startup, upgrade, backup, restore, logs, and rollback procedures
- Health, local-origin, DNS, HTTPS, and authentication validation
- Cloudflare route preservation and troubleshooting

The README receives a concise production deployment entry and marks the
original eleven MVP milestones complete.

## Validation

Milestone 11 is complete only after:

- Health service tests pass for healthy and degraded dependencies.
- Full tests, typecheck, lint, Prisma validation, and production build pass.
- Docker Compose starts with PostgreSQL, Redis, and web healthy.
- `/api/health` succeeds locally and inside the container.
- The active Cloudflare config validates and retains all existing rules.
- DNS resolves `arcticrss.taverncellar.com` to the named tunnel.
- Public HTTPS serves Arctic RSS and its health endpoint.
- Auth.js login/signup pages load through the public hostname.
- No credentials or tunnel tokens are added to tracked files.

## Milestone Boundary

This milestone completes the original Arctic RSS MVP plan. Scheduled digest
delivery, email delivery, billing, native clients, and other post-MVP work
remain separate future milestones.

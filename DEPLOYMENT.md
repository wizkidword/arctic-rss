# Arctic RSS Deployment

Arctic RSS runs as four core containers:

- `web`: production Next.js standalone server
- `worker`: BullMQ feed-refresh and AI-digest worker
- `postgres`: PostgreSQL with a persistent volume
- `redis`: Redis with append-only persistence

An optional `cloudflared` container is available through the `tunnel` Compose
profile. The Tavern Cellar deployment instead uses an existing host-managed
named tunnel because that tunnel also serves other applications.

## Production Requirements

- Docker Engine with Docker Compose v2
- A persistent host with outbound Internet access
- A domain or reverse proxy for public access
- At least 2 GB RAM for the complete local stack
- Backups stored outside the Docker volumes

No inbound firewall port is required when Cloudflare Tunnel is used.

## Environment

Create `.env` from `.env.example` and keep it untracked.

Required production values:

```dotenv
DATABASE_URL="postgresql://postgres:REPLACE_DB_PASSWORD@postgres:5432/arctic_rss?schema=public"
REDIS_URL="redis://redis:6379"

POSTGRES_DB=arctic_rss
POSTGRES_USER=postgres
POSTGRES_PASSWORD="REPLACE_DB_PASSWORD"

WEB_PORT=3000
POSTGRES_PORT=5432
REDIS_PORT=6379

AUTH_SECRET="REPLACE_AUTH_SECRET"
AUTH_TRUST_HOST=true
AUTH_URL="https://rss.example.com"
NEXTAUTH_URL="https://rss.example.com"
NEXT_PUBLIC_APP_URL="https://rss.example.com"

ADMIN_EMAILS="owner@example.com"
CRON_SECRET="REPLACE_CRON_SECRET"
```

Generate secrets with either:

```powershell
# PowerShell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

```bash
# Linux/macOS
openssl rand -base64 32
```

The database password in `DATABASE_URL` must match `POSTGRES_PASSWORD`.
Percent-encode URL-reserved characters in the password used by
`DATABASE_URL`.

Optional AI values:

```dotenv
AI_PROVIDER=""
AI_DEFAULT_MODEL=""
OPENAI_SUMMARY_MODEL=""
AI_DIGEST_MODEL=""
AI_DIGEST_CONCURRENCY=2
OPENAI_API_KEY=""
ANTHROPIC_API_KEY=""
```

The local deterministic AI providers are used when `AI_PROVIDER` is empty.

## Start The Stack

Build and start:

```bash
docker compose up -d --build
```

Check status:

```bash
docker compose ps
docker compose logs --tail 100 web worker
```

PostgreSQL, Redis, and web should report healthy. The worker should report
`Arctic RSS worker online`.

The published ports bind only to `127.0.0.1`. Other machines cannot connect
directly to PostgreSQL, Redis, or the Next.js origin.

## Readiness

Local host:

```bash
curl --fail http://localhost:3000/api/health
```

Inside the web container:

```bash
docker compose exec -T web node -e \
  "fetch('http://127.0.0.1:3000/api/health').then(async r => { console.log(await r.text()); process.exit(r.ok ? 0 : 1) })"
```

Healthy response:

```json
{"checks":{"database":"ok","redis":"ok"},"status":"ok"}
```

The endpoint returns HTTP `503` when PostgreSQL or Redis is unavailable. It
does not return credentials, connection strings, or raw dependency errors.

## Tavern Cellar Windows Deployment

The current deployment uses:

- Origin: `http://localhost:3003`
- Public URL: `https://arcticrss.taverncellar.com`
- Named tunnel: `arctic-tavern-prod`
- Tunnel ID: `bf50505d-96e9-4027-a121-d53fa66988d7`
- Config: `C:\Users\Elwynn\.cloudflared\config.yml`

The `.env` values are:

```dotenv
WEB_PORT=3003
AUTH_URL="https://arcticrss.taverncellar.com"
NEXTAUTH_URL="https://arcticrss.taverncellar.com"
NEXT_PUBLIC_APP_URL="https://arcticrss.taverncellar.com"
AUTH_TRUST_HOST=true
```

The shared tunnel ingress rules must keep their existing order and final
catch-all:

```yaml
ingress:
  - hostname: watch.taverncellar.com
    service: http://localhost:3310
  - hostname: erp.taverncellar.com
    service: http://localhost:3000
  - hostname: arcticrss.taverncellar.com
    service: http://localhost:3003
  - service: http_status:404
```

Validate the config:

```powershell
cloudflared tunnel --config C:\Users\Elwynn\.cloudflared\config.yml ingress validate
cloudflared tunnel --config C:\Users\Elwynn\.cloudflared\config.yml ingress rule https://arcticrss.taverncellar.com
```

Create the DNS route once:

```powershell
cloudflared tunnel route dns arctic-tavern-prod arcticrss.taverncellar.com
```

Run the connector:

```powershell
cloudflared tunnel --config C:\Users\Elwynn\.cloudflared\config.yml run arctic-tavern-prod
```

### Windows Restart Persistence

Docker Desktop is configured to start when the `Elwynn` Windows account signs
in. The Compose services use `restart: unless-stopped`, so PostgreSQL, Redis,
the web app, and the worker return when the Docker engine is available.

The shared named tunnel is registered in Task Scheduler as:

```text
Arctic RSS Cloudflare Tunnel
```

The task starts 30 seconds after sign-in, runs:

```powershell
"C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --config "C:\Users\Elwynn\.cloudflared\config.yml" run arctic-tavern-prod
```

and retries the connector one minute after an unexpected exit. Inspect it
with:

```powershell
Get-ScheduledTask -TaskName "Arctic RSS Cloudflare Tunnel"
Get-ScheduledTaskInfo -TaskName "Arctic RSS Cloudflare Tunnel"
```

Start or restart only the scheduled connector with:

```powershell
Stop-ScheduledTask -TaskName "Arctic RSS Cloudflare Tunnel"
Start-ScheduledTask -TaskName "Arctic RSS Cloudflare Tunnel"
```

Do not put the named-tunnel credential JSON or `cert.pem` in this repository.
The host-managed connector must remain separate from the optional Compose
tunnel profile.

## Portable Token-Based Cloudflare Tunnel

For a deployment dedicated to Arctic RSS:

1. Create a remotely-managed Cloudflare Tunnel.
2. Add a published application route whose service URL is
   `http://web:3000`.
3. Put the tunnel token in the untracked `.env`:

```dotenv
CLOUDFLARE_TUNNEL_TOKEN="REPLACE_TUNNEL_TOKEN"
```

4. Start the tunnel profile:

```bash
docker compose --profile tunnel up -d --build
```

Check:

```bash
docker compose --profile tunnel ps
docker compose logs --tail 100 cloudflared
```

The image is pinned to `cloudflare/cloudflared:2026.6.1`. Review Cloudflare's
official release notes before changing the pin.

## VPS Or Linux Home Server

1. Install Docker Engine and the Compose plugin.
2. Clone Arctic RSS into a persistent application directory.
3. Create the production `.env`.
4. Start the stack with `docker compose up -d --build`.
5. Use either the token-based tunnel profile or a host-managed reverse proxy.
6. Validate `/api/health`, signup, login, the reader, the worker logs, and the
   admin dashboard.

When using an external PostgreSQL service, set `DATABASE_URL` to that service.
The bundled PostgreSQL container may remain unused or be removed from a
deployment-specific Compose override. The same pattern applies to external
Redis through `REDIS_URL`.

## Schema Management

The current MVP uses:

```bash
npx prisma db push
```

through the one-shot `migrate` container because the repository does not yet
have a migration baseline. Back up the database before every schema-changing
upgrade.

Before a multi-instance or long-lived production rollout, create a Prisma
migration baseline and change the deployment command to:

```bash
npx prisma migrate deploy
```

Do not switch commands until the migration history has been created and tested
against a restored backup.

## Upgrade

```bash
docker compose pull
docker compose build --pull
docker compose up -d
docker compose ps
curl --fail http://localhost:3000/api/health
```

For a source checkout, pull or check out the intended release before building.
Avoid deploying directly from an unreviewed branch.

## Backup

Create a PostgreSQL plain-text backup:

```bash
docker compose exec -T postgres sh -c \
  'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > arctic-rss.sql
```

Copy the backup off the host and test restores regularly.

Redis contains queue state rather than the canonical reader data. Its
append-only volume improves restart recovery, but PostgreSQL is the required
data backup.

## Restore

Stop application writes:

```bash
docker compose stop web worker
```

Restore into an empty compatible database:

```bash
docker compose exec -T postgres sh -c \
  'psql -U "$POSTGRES_USER" "$POSTGRES_DB"' < arctic-rss.sql
```

Restart and validate:

```bash
docker compose start web worker
curl --fail http://localhost:3000/api/health
```

## Rollback

1. Stop web and worker.
2. Restore the database backup when the release changed the schema.
3. Check out the previous known-good release.
4. Rebuild with `docker compose up -d --build`.
5. Verify health, authentication, feed refresh, AI actions, and the public
   hostname.

Do not roll application code backward across an incompatible database schema
without restoring the matching backup.

## Operations

Useful commands:

```bash
docker compose ps
docker compose logs -f web
docker compose logs -f worker
docker compose restart web worker
docker compose exec postgres pg_isready -U postgres -d arctic_rss
docker compose exec redis redis-cli ping
```

The admin dashboard at `/admin` shows users, failing or stale feeds, monthly AI
usage, persisted failures, and recent failed BullMQ jobs.

## Public Validation

```bash
curl --fail https://rss.example.com/api/health
curl --head --fail https://rss.example.com/login
```

Also verify:

- Landing page loads over HTTPS.
- Signup and login remain on the public hostname.
- Authentication cookies are secure.
- `/app` requires authentication.
- `/admin` requires an administrator.
- Feed refresh jobs are processed by the worker.
- Existing tunnel hostnames still reach their original services.

## Troubleshooting

### Cloudflare returns 502

- Confirm `curl http://localhost:WEB_PORT/api/health` works on the tunnel host.
- Confirm the ingress service port matches `WEB_PORT`.
- Validate ingress ordering and keep the catch-all last.
- Check `cloudflared tunnel info TUNNEL_NAME`.

### Web is unhealthy

- Run `docker compose logs web`.
- Call the health endpoint from inside the container.
- Check PostgreSQL and Redis health.
- Confirm `DATABASE_URL` and `REDIS_URL` use reachable service names.

### Authentication redirects to localhost

Set all three public URL variables:

```dotenv
AUTH_URL="https://rss.example.com"
NEXTAUTH_URL="https://rss.example.com"
NEXT_PUBLIC_APP_URL="https://rss.example.com"
```

Then rebuild the web image and restart the stack.

### Feed refresh does not run

- Check `docker compose logs worker`.
- Confirm Redis is healthy.
- Verify the feed is not paused.
- Inspect failed jobs from `/admin`.

# Milestone 11 Production Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Harden, document, and publicly validate Arctic RSS as a Docker-based self-hosted application at `https://arcticrss.taverncellar.com`.

**Architecture:** The existing Compose stack remains the application runtime, with a dependency-aware health route and loopback-only host ports. The current Windows host continues using its shared locally-managed named Cloudflare Tunnel, while the optional Compose profile supports portable token-based tunnel deployments.

**Tech Stack:** Next.js 16 Route Handlers, Prisma/PostgreSQL, BullMQ/Redis, Docker Compose, Cloudflare Tunnel, Auth.js, Vitest.

---

### Task 1: Dependency-Aware Health Route

**Files:**
- Create: `src/lib/system-health.test.ts`
- Create: `src/lib/system-health.ts`
- Create: `src/app/api/health/route.test.ts`
- Create: `src/app/api/health/route.ts`

- [x] **Step 1: Write failing service tests**

Test a healthy database and Redis queue, a database failure, and a Redis
failure using injected clients. Expected output must contain only `ok` or
`failed` dependency states and no raw errors.

- [x] **Step 2: Verify the service tests fail**

Run:

```powershell
npm test -- src/lib/system-health.test.ts
```

Expected: FAIL because `system-health.ts` does not exist.

- [x] **Step 3: Implement the health service**

Expose:

```ts
export async function checkSystemHealthWithClients({
  database,
  queue,
}: {
  database: { countUsers(): Promise<number> }
  queue: { checkConnection(): Promise<void> }
}) {
  const [databaseResult, redisResult] = await Promise.allSettled([
    database.countUsers(),
    queue.checkConnection(),
  ])

  const checks = {
    database: databaseResult.status === "fulfilled" ? "ok" : "failed",
    redis: redisResult.status === "fulfilled" ? "ok" : "failed",
  } as const

  return {
    checks,
    status:
      checks.database === "ok" && checks.redis === "ok" ? "ok" : "degraded",
  }
}
```

The production wrapper lazily uses `getPrisma()` and
`getFeedRefreshQueue().getJobCounts("waiting")`.

- [x] **Step 4: Verify the service tests pass**

Run:

```powershell
npm test -- src/lib/system-health.test.ts
```

Expected: PASS.

- [x] **Step 5: Write failing route tests**

Mock the service result and assert HTTP `200` for `ok`, HTTP `503` for
`degraded`, JSON content type, and `Cache-Control: no-store`.

- [x] **Step 6: Implement and verify the Route Handler**

Run:

```powershell
npm test -- src/app/api/health/route.test.ts
```

Expected: PASS.

### Task 2: Docker Compose Production Hardening

**Files:**
- Modify: `Dockerfile`
- Modify: `docker-compose.yml`
- Modify: `.env.example`

- [x] **Step 1: Add the web healthcheck**

Use Node's built-in `fetch` from inside the runner image:

```yaml
healthcheck:
  test:
    - CMD
    - node
    - -e
    - "fetch('http://127.0.0.1:3000/api/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"
  interval: 30s
  timeout: 10s
  retries: 5
  start_period: 30s
```

- [x] **Step 2: Restrict host port bindings**

Bind web, PostgreSQL, and Redis to `127.0.0.1` while leaving service-to-service
Compose networking unchanged.

- [x] **Step 3: Parameterize PostgreSQL and pin cloudflared**

Use `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD` with development
fallbacks. Pin `cloudflare/cloudflared:2026.6.1` and make it depend on a healthy
web service.

- [x] **Step 4: Validate the Compose model**

Run:

```powershell
docker compose config
docker compose --profile tunnel config
```

Expected: both configurations render successfully without exposing secret
values in committed files.

### Task 3: Production Environment And Deployment Guide

**Files:**
- Create: `DEPLOYMENT.md`
- Modify: `.env.example`
- Modify: `README.md`

- [x] **Step 1: Document production environment values**

Add `AUTH_URL`, configurable PostgreSQL values, public HTTPS URLs, generated
secret requirements, and the optional tunnel token.

- [x] **Step 2: Write the deployment guide**

Document:

- Current Windows named-tunnel deployment
- Generic Linux/VPS deployment
- Token-based Compose tunnel profile
- External database/Redis configuration
- Startup, upgrade, backup, restore, logs, rollback, and validation

- [x] **Step 3: Update milestone status**

Mark the original MVP milestones complete and link to `DEPLOYMENT.md`.

### Task 4: Active Named Tunnel Routing

**Files outside repository:**
- Modify: `C:\Users\Elwynn\.cloudflared\config.yml`

- [x] **Step 1: Preserve and extend ingress configuration**

Insert:

```yaml
  - hostname: arcticrss.taverncellar.com
    service: http://localhost:3003
```

after the existing `erp.taverncellar.com` rule and before the catch-all.

- [x] **Step 2: Validate all ingress rules**

Run:

```powershell
cloudflared tunnel --config C:\Users\Elwynn\.cloudflared\config.yml ingress validate
cloudflared tunnel --config C:\Users\Elwynn\.cloudflared\config.yml ingress rule https://arcticrss.taverncellar.com
```

Expected: configuration is valid and the new hostname maps to
`http://localhost:3003`.

- [x] **Step 3: Create the tunnel DNS route**

Run:

```powershell
cloudflared tunnel route dns arctic-tavern-prod arcticrss.taverncellar.com
```

Do not use `--overwrite-dns` unless an existing conflicting record is first
identified and reviewed.

- [x] **Step 4: Restart only the existing tunnel connector**

Stop the process using the exact current config and tunnel, then relaunch:

```powershell
cloudflared tunnel --config C:\Users\Elwynn\.cloudflared\config.yml run arctic-tavern-prod
```

Keep it hidden and verify all three public hostnames still match their ingress
rules.

### Task 5: Production Runtime Validation

**Files:**
- Modify: `.env` without exposing values in output

- [x] **Step 1: Set public runtime URL values**

Set:

```dotenv
AUTH_URL="https://arcticrss.taverncellar.com"
NEXTAUTH_URL="https://arcticrss.taverncellar.com"
NEXT_PUBLIC_APP_URL="https://arcticrss.taverncellar.com"
AUTH_TRUST_HOST=true
```

Preserve all existing secrets.

- [x] **Step 2: Rebuild and start Docker**

Run:

```powershell
docker compose up -d --build
docker compose ps
```

Expected: PostgreSQL, Redis, and web are healthy; worker is running.

- [x] **Step 3: Verify local readiness**

Run:

```powershell
curl.exe --fail http://localhost:3003/api/health
docker compose exec -T web node -e "fetch('http://127.0.0.1:3000/api/health').then(async r => { console.log(await r.text()); process.exit(r.ok ? 0 : 1) })"
```

Expected: both return HTTP `200` with database and Redis `ok`.

- [x] **Step 4: Verify DNS and public HTTPS**

Run:

```powershell
Resolve-DnsName arcticrss.taverncellar.com
curl.exe --fail https://arcticrss.taverncellar.com/api/health
curl.exe --head --fail https://arcticrss.taverncellar.com/login
```

Expected: DNS resolves through Cloudflare, health returns `ok`, and login
returns a successful HTTPS response.

- [x] **Step 5: Browser smoke test**

Use the in-app browser to verify the public landing page, signup, login, and
health endpoint. Confirm no framework error overlay and no relevant console
errors.

### Task 6: Final Verification

**Files:**
- Complete the checkboxes in this plan

- [x] **Step 1: Run the full verification suite**

Run:

```powershell
npm test
npm run typecheck
npm run lint
npx prisma validate
npm run build
```

Expected: all pass.

- [x] **Step 2: Verify no credentials are tracked**

Inspect Git status and search committed examples for real token, credential
file, and secret values. `.env` and Cloudflare credential files must remain
ignored.

- [x] **Step 3: Record Milestone 11 complete**

Update the README and this checklist only after all local, container, DNS,
HTTPS, and browser checks pass.

# Arctic RSS

Arctic RSS is a self-hosted RSS reader inspired by Google Reader. The current foundation includes Next.js App Router, TypeScript, Tailwind, shadcn/ui, Auth.js credentials auth, Prisma/PostgreSQL, a protected reader shell, per-user view settings, an operational admin dashboard, feed subscription discovery, RSS/Atom article ingestion, folder management, OPML import/export, on-demand article AI summaries, stored unread AI digests, Redis-backed workers, and Docker Compose.

The active deployment is the self-hosted site at
[arcticrss.com](https://arcticrss.com). See [PROJECT.md](PROJECT.md) for the
operating model and [DEPLOYMENT.md](DEPLOYMENT.md) for deployment and recovery
procedures.

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- Auth.js / NextAuth credentials auth
- Prisma 7 with PostgreSQL
- Redis-backed BullMQ worker container
- Docker Compose

## Local Development

Use Node.js 22 or newer. Node 24 is pinned in [`.nvmrc`](.nvmrc) to match the
production Docker image.

1. Install dependencies:

```bash
npm install
```

1. Create an environment file:

```bash
cp .env.example .env
```

1. Update the `CHANGE_ME` values in `.env`. The example URLs target Docker
   service names; when running `npm run dev` directly on the host, use
   `localhost` for PostgreSQL and Redis.

1. Generate the Prisma client and apply committed migrations:

```bash
npm run prisma:generate
npm run prisma:deploy
```

1. Start the app:

```bash
npm run dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

## Docker

Copy `.env.example` to `.env`, then start the stack:

```bash
docker compose up --build
```

Services:

- `web`: Next.js app on port `3000`
- `worker`: background feed refresh worker
- `postgres`: PostgreSQL database
- `redis`: Redis queue/cache dependency
- `migrate`: one-shot Prisma `migrate deploy` for committed migrations
- `cloudflared`: optional tunnel service behind the `tunnel` profile

To run with Cloudflare Tunnel:

```bash
docker compose --profile tunnel up --build
```

Production is served through Cloudflare at
[https://arcticrss.com](https://arcticrss.com). See
[DEPLOYMENT.md](DEPLOYMENT.md) and [PROJECT.md](PROJECT.md) for the Hetzner
runbook, backups, restores, upgrades, rollbacks, and health validation.

The public-safe readiness endpoint is available at `/api/health`. Docker uses
the loopback-only liveness endpoint at `/api/live`.

## Auth

This project uses Auth.js with local email/password credentials as the
open-source default. Credentials and Google signups always begin as `USER` /
`FREE`; a signup can never grant the `ADMIN` role. Production requires verified
email addresses.

Promote an existing, active, verified account only from a trusted server shell:

```bash
npm run admin:bootstrap -- --email admin@example.com
```

The command is idempotent and writes an `ADMIN_BOOTSTRAP_PROMOTE` audit event.
It has no HTTP endpoint, refuses missing, disabled, ambiguous, or unverified
targets, and does not display the target address.

## AI Summaries

Article summaries and unread digests use deterministic local providers by default, so development and self-hosted installs work without an external AI account. Set `AI_PROVIDER=openai` and `OPENAI_API_KEY` to use the OpenAI Responses API instead. `AI_DEFAULT_MODEL`, `OPENAI_SUMMARY_MODEL`, and `AI_DIGEST_MODEL` can override models. The `/app/ai` dashboard shows monthly usage, recent summaries, eligible unread articles, stored digest history, and per-user AI preferences.

## Scripts

```bash
npm run dev
npm run admin:bootstrap -- --email admin@example.com
npm run build
npm run start
npm run lint
npm run test
npm run test:e2e
npm run typecheck
npm run prisma:generate
npm run prisma:migrate
npm run prisma:deploy
npm run worker
```

## Current Milestone

Done:

- Public landing page
- Signup and login pages
- Authenticated `/app` reader shell
- Sidebar placeholder
- Classic/Card/Compact/River view switcher
- User settings model and persistence action
- Admin role support and protected `/admin`
- Prisma schema for the planned RSS reader domain
- Docker Compose foundation
- Add Feed sheet
- Safe feed URL validation and SSRF checks
- RSS/Atom feed discovery from website URLs
- Feed subscription persistence
- Curated Feed Directory with extensible categories
- One-click catalog subscription with Uncategorized or folder assignment
- Sidebar feed display
- RSS/Atom article parsing
- Article upsert and duplicate prevention
- Feed health/error tracking during refresh
- Manual feed refresh action
- BullMQ feed refresh queue and worker
- Stored articles on the All Articles and feed pages
- Placeholder route for general settings
- Main reader surface for Classic, Card, Compact, and River views
- Per-user read/unread state
- Per-user starred state and Starred view
- Unread counts in the sidebar and feed list
- Folder management with create, rename, delete, and feed move actions
- Confirmed feed unsubscribe from feed pages and Feed Organization
- Subscription removal that preserves shared articles and personal read/starred history
- Sidebar folder navigation with folder unread counts
- Folder-scoped reader pages
- Add Feed folder assignment
- OPML import/export with folder preservation and import summaries
- Mark all read for all articles, folders, and individual feeds
- Sanitized article HTML rendering
- On-demand article AI summaries with cached results
- Per-user AI monthly usage limits and usage logging
- Local summary provider with optional OpenAI provider
- Stable article detail routes with reader permalinks
- Reader keyboard shortcuts for next, previous, read/unread, star, and open original
- AI dashboard with monthly usage and recent summary history
- Stored AI digests generated from unread articles
- Must Read and Skim Later digest sections with topic labels
- Dedicated BullMQ digest queue and worker processing
- Digest history with pending, completed, and failed states
- Local digest provider with optional OpenAI provider
- Per-user automatic-summary and daily-digest preferences
- Operational admin statistics and user monitoring
- Paginated admin user, feedback, and feed-health reports with independently streamed panels
- Failing and stale feed health views
- Date-range AI token, request, provider/model, and cost reporting
- Persisted and BullMQ failed-job monitoring
- Dependency-aware readiness checks for PostgreSQL and Redis
- Loopback-only production Docker port bindings
- Production deployment, backup, restore, upgrade, and rollback documentation
- Self-hosted production deployment at `arcticrss.com`

Status:

- Original MVP milestones 1-11 complete
- Post-MVP work can proceed from the deployed, self-hosted foundation

## License

MIT

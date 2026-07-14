# Arctic RSS

> Follow the open web without the noise.

[Open Arctic RSS](https://arcticrss.com) · [Report a security issue](SECURITY.md) · [Contributing](CONTRIBUTING.md)

Arctic RSS is a browser-based reader and community space for the open web. It
brings RSS and Atom feeds, podcasts, AI-assisted reading, and Arctic IRC into
one account and one calm reading experience. The active deployment is
[arcticrss.com](https://arcticrss.com); this repository also contains the
Docker-based self-hosting stack and non-secret operational documentation.

## Product

- **Reader and discovery:** Follow RSS and Atom feeds, browse a curated
  directory, organize sources into folders, use Classic/Card/Compact/River
  views, and keep personal read and starred states.
- **Podcasts and collections:** Discover or add podcast RSS feeds, stream and
  resume episodes, and save articles or episodes into personal collections.
- **AI digests:** Generate on-demand article summaries, keep digest history,
  and create topic-focused Smart Digests from selected sources.
- **Arctic IRC:** Use the same Arctic account for browser-first native community
  rooms, article sharing, reporting, moderation, and room discovery. Arctic
  IRC is an account-based chat experience, not an IRC protocol server.
- **Operations:** Email-verified accounts, role-protected administration,
  background refresh workers, health checks, backups, and a production
  Docker Compose deployment.

## Scope

Arctic RSS reads and organizes third-party feeds; publishers retain ownership
of their content. Podcast audio is streamed from the original enclosure URL.
Arctic IRC is currently a beta feature for eligible signed-in users. External
network and channel links lead to independently operated services with their
own rules and retention practices.

See [PROJECT.md](PROJECT.md) for the operating model,
[DEPLOYMENT.md](DEPLOYMENT.md) for generic deployment and recovery guidance,
and [docs/roadmaps/product-roadmap.md](docs/roadmaps/product-roadmap.md) for
planned product work.

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

## Product status

The reader, podcasts, AI features, Arctic IRC beta, administration tools, and
production deployment are active. The roadmap distinguishes planned work from
the product described above; it is not a statement of currently available
features.

## License

MIT

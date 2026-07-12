# Arctic RSS project guide

This repository is the working copy for [arcticrss.com](https://arcticrss.com), a
self-hosted RSS reader running on a Hetzner VPS. It is intentionally prepared
for private source control and private operations.

## Current production topology

- Public site: `https://arcticrss.com`
- Hetzner VPS: `167.233.134.252` (Falkenstein)
- Application directory: `/opt/arctic-rss/app`
- Core Docker Compose services: `web`, `worker`, `postgres`, `redis`, and
  one-shot `migrate`
- The web, PostgreSQL, and Redis ports are loopback-only on the VPS.
- Cloudflare routes public traffic through a separate running
  `arctic-rss-cloudflared` container. It is not part of the active core Compose
  service set.
- Health checks: `curl -fsS http://127.0.0.1:3000/api/health` on the VPS and
  `curl -fsS https://arcticrss.com/api/health` publicly.

The production `.env` remains on the VPS. It contains credentials and must
never be printed, copied into this repository, or replaced during deployment.

## Source-control policy

- This checkout was imported from the VPS without `.env`, dependencies, build
  output, generated Prisma code, OPML imports, or the VPS Git metadata.
- The source copy on the VPS has no configured Git remote. This local
  repository is the canonical development checkout going forward.
- No remote has been added to this checkout. If a GitHub backup is later
  created, create or verify the repository as **private before the first
  push**. Never use a public repository for this project.
- The existing `LICENSE` is MIT. That is a separate legal distribution choice;
  it has been left unchanged rather than making an unrequested licensing change.

## Local development

1. Copy `.env.example` to `.env` and use only local development credentials.
2. Run `npm install` and `npm run prisma:generate`.
3. Start PostgreSQL and Redis through Docker Compose, then run the app with
   `npm run dev`, or run the full stack with `docker compose up --build`.
4. Before a code change is considered ready, run `npm test`, `npm run typecheck`,
   and `npm run build`.

The example environment uses Docker service hostnames. For `npm run dev` on the
host machine, change `DATABASE_URL` and `REDIS_URL` from `postgres`/`redis` to
`localhost`.

## Deployment guardrails

1. Start from a reviewed local change and create a clean source archive.
2. Exclude `.env`, `.git`, `node_modules`, `.next`, `tmp`, `out`, `coverage`,
   `src/generated/prisma`, `tsconfig.tsbuildinfo`, and `*.opml`.
3. Upload the archive to `/opt/arctic-rss`, unpack it to a new release folder,
   and copy the existing production `.env` into that folder.
4. Retain the previous app folder as a rollback candidate, then switch the
   release into `/opt/arctic-rss/app`.
5. Run `docker compose up --build -d` as a separate plain SSH command, followed
   by `docker compose ps` and both health checks above.

Avoid PowerShell here-strings for the final remote Docker command: CRLF line
endings can cause Docker to parse `-d` incorrectly.

## Implemented product areas

- Credentials authentication, Google OAuth, email verification, welcome email,
  password reset, and Cloudflare Turnstile.
- Authenticated reader with Classic, Card, Compact, and River views; article
  navigation, reading state, stars, folders, collections, and OPML import/export.
- RSS/Atom feed discovery and ingestion, Redis-backed refresh workers, feed
  health monitoring, and a protected admin dashboard.
- Discover directory with category customization, country/topic cards, Reddit
  sources, and admin OPML import.
- Podcasts, guest browsing, bug reports, feature suggestions, legal pages,
  support link, Google Analytics, and AI summaries/digests.
- The latest reader regression fix renders an article image inside the sanitized
  body only when no body image exists, avoiding duplicate media previews.

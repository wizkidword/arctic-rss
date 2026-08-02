# Arctic RSS project guide

Arctic RSS is the self-hosted service behind [arcticrss.com](https://arcticrss.com).
This repository contains application source, generic deployment guidance, and
non-secret operational runbooks. Keep server addresses, SSH identities, tunnel
identifiers, release paths, backup locations, and environment values in a
private operator inventory outside the repository.

## Production shape

- Cloudflare routes public traffic to a loopback-bound web container.
- Docker Compose runs one selected worker topology alongside `web`,
  PostgreSQL, durable Redis, ephemeral Redis, and the one-shot `migrate`
  service. The all-in-one worker and split workers are mutually exclusive.
- PostgreSQL and Redis are private to the host; Redis uses append-only
  persistence for queue recovery.
- `web` and `worker` run as unprivileged container users and have health checks.
- `/api/live` is an internal, loopback-only liveness endpoint. `/api/health`
  is the public-safe readiness endpoint for PostgreSQL and Redis.

## Source-control policy

- Never commit `.env`, SSH keys, tunnel credentials, database dumps, OPML
  exports, generated output, or production logs.
- Before making any repository public, audit both the current files and Git
  history for operational details and secrets. Keep the private operator
  inventory outside source control.
- Release archives are built from reviewed commits. The production host is not
  a Git checkout and should retain the previous release directory for rollback.

## Local development

1. Copy `.env.example` to `.env` and use only local development credentials.
2. Run `npm install` and `npm run prisma:generate`.
3. Start PostgreSQL plus durable and ephemeral Redis through Docker Compose,
   then run `npm run dev`, or run the all-in-one stack with
   `docker compose --profile all-in-one up --build`.
4. Before committing, run `npm test`, `npm run typecheck`, and `npm run build`.

The example environment uses Docker service hostnames. For `npm run dev` on a
host machine, change `DATABASE_URL`, `DURABLE_REDIS_URL`, and
`EPHEMERAL_REDIS_URL` to `localhost`; use the PostgreSQL, durable-Redis, and
ephemeral-Redis loopback ports from `.env.example`. `REDIS_URL` is retained
only for an explicitly flagged temporary one-Redis migration; production
otherwise requires distinct workload-specific endpoints. Remove it before
Phase 5 begins.

## Deployment guardrails

1. Start from a reviewed commit and create a clean source archive.
2. Preserve the existing production `.env` with owner-only permissions; never
   display or replace it during deployment.
3. Create and validate a PostgreSQL backup before the release swap.
4. Choose a documented topology, build its application images and `migrate`,
   then run committed migrations before recreating every selected application
   service.
5. Retain the previous release as the rollback candidate, then verify internal
   liveness, internal readiness, public readiness, login, and the changed flow.

See [DEPLOYMENT.md](DEPLOYMENT.md) and [docs/operations](docs/operations) for
the complete generic procedures. The canonical service and profile list is
[docs/operations/deployment-topologies.md](docs/operations/deployment-topologies.md).

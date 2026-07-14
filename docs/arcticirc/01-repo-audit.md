# Arctic IRC repository audit

## Audit scope and result

The repository is a clean Git checkout on `main` with a configured `origin` remote. No repository configuration was changed. Arctic RSS is a Next.js 16.2.10 App Router application using TypeScript, Prisma 7 with PostgreSQL, Redis/BullMQ, Auth.js v5, Docker Compose, Vitest, and Playwright.

The project already meets the plan's major platform assumptions, with one important correction: its Discover interests are runtime-derived from a directory rather than persisted as a single Prisma topic model.

## Existing components to reuse

| Concern | Repository implementation | Arctic IRC use |
| --- | --- | --- |
| App routes | `src/app/**` App Router | Add isolated `/irc/**` routes; keep data work server-side and interactivity in small client components. |
| Authentication | `src/auth.ts` | Reuse Auth.js session identity and `authVersion`; do not create a chat login. |
| Fresh authorization | `src/lib/authorization.ts` | Build chat authorization on `requireFreshUser`; it already rejects disabled users and revoked/stale sessions. |
| Email verification | `User.emailVerified`, `src/lib/email-verification-policy.ts` | Chat entry/session issuance must apply the existing verified-email policy. |
| Global roles | `Role` enum in `prisma/schema.prisma` | Existing roles are only `USER` and `ADMIN`; chat moderator/room roles must be additive chat-domain data. |
| Data access | `src/lib/db.ts` | Reuse lazy `getPrisma()` with the existing PostgreSQL runtime account. |
| Redis and queues | `src/lib/feed-refresh-queue.ts`, `src/lib/rate-limit.ts`, `worker/index.ts` | Reuse `REDIS_URL` and BullMQ conventions; extract shared Redis creation only when the gateway is added. |
| Rate limiting | `src/lib/rate-limit.ts` | Extend its hashed-subject Redis limiter with typed chat actions; preserve fail-closed behaviour. |
| Discover taxonomy | `src/lib/discover-directory.ts`, `src/lib/discover-interests.ts` | Validate and display canonical interest IDs; do not add a competing topic model. |
| Feed/article data | `Feed`, `Article` models | Native chat links use existing IDs, never duplicate content or full article bodies. |
| Admin audit | `AdminAuditLog`, `src/app/admin/actions.ts` | Reuse its audited-action convention; add append-only chat-domain audit records for room moderation. |
| Security boundary | `src/proxy.ts`, `src/lib/content-security-policy.ts`, `next.config.ts` | Extend exact origin/CSP rules before the WSS gateway is exposed. |
| Operations | `docker-compose.yml`, `DEPLOYMENT.md` | Add the gateway as an internal, health-checked service only after Phase 2. |

## Existing constraints that change the generic plan

1. There is no generic Prisma `Interest`/`Topic` model. `DiscoverCategory` and `DiscoverFeed` support only the dynamic portion of the directory; static entries live in source. A `ChatRoomInterest.interestId` must therefore be a normalized string validated through the directory service, not a foreign key.
2. There is no feature-flag framework. Phase 1 should introduce a small server-only `src/lib/chat/feature-flags.ts` that parses `ARCTIC_IRC_*` variables conservatively, rather than adding a vendor or exposing flags to the browser.
3. There is no moderator role or generic suspension field beyond `User.disabledAt`. Phase 1 can enforce existing disabled/admin states and room membership roles. Global chat sanctions and moderator roles belong to the later moderation phase.
4. The application has no realtime dependency or service. Do not add Socket.IO, a bouncer, or a workspace conversion in Phase 1. The gateway begins in Phase 2 and must be independently health checked.
5. Existing server mutations primarily use Server Actions, while the only Route Handlers are health/auth/image/CSP endpoints. Chat's browser-to-gateway session endpoint should be a Route Handler in Phase 2 because it has a stable API contract; normal room UI mutations can remain server actions where appropriate.

## Phase 1 exact change boundary

Create or change only the following areas, after a Phase 1 implementation review:

- `prisma/schema.prisma` and one new additive migration directory.
- `src/lib/chat/feature-flags.ts` and tests.
- `src/lib/chat/normalization.ts` and tests for handles, room slugs, reserved names, and canonical interest IDs.
- `src/lib/chat/permissions.ts` and a fully enumerated permission-matrix test.
- `src/lib/chat/official-rooms.ts` plus a separately invoked idempotent bootstrap script under `scripts/`; it must not run automatically in `postinstall` or migrations.
- `.env.example` and `docs/arcticirc/*` for flag/bootstrap instructions.

Phase 1 must not add an `/irc` route, render a Chat navigation item, open a socket, alter existing reader queries, or enable a service. A disabled feature cannot accidentally expose chat data or UI.

## Commands and test conventions

The verified project scripts are:

```powershell
npm install
npm run prisma:generate
npm test
npm run typecheck
npm run build
npm run test:e2e
```

`npm run lint` is also available. Prisma production deployment uses `npm run prisma:deploy`; production must never use `prisma db push`. The Compose services are `postgres`, `redis`, `migrate`, `web`, `worker`, and optional-profile `cloudflared`; all non-web data services bind only to loopback. The public readiness endpoint is `/api/health` and the loopback-only liveness endpoint is `/api/live`.

## Open questions requiring owner decisions before their phase

- Which verified users form the first chat beta allowlist, and should the initial release enforce it in Phase 1 or Phase 2?
- What is the approved native-message and audit-evidence retention policy? The plan's 90-day example is not an approved policy.
- Which legal text and age policy applies before invitations are sent?
- Which third-party IRC network, if any, has supplied approval for a datacenter-hosted bouncer/WebIRC arrangement? No external connection should be enabled without that record.

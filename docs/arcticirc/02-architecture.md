# Arctic IRC architecture decision record

## Decision

Implement native Arctic chat inside the existing web application for pages, durable state, REST/session routes, and moderation screens. Introduce a separate long-running Node/TypeScript gateway only in Phase 2 for WSS connections. PostgreSQL remains the durable source of truth; Redis is only for ephemeral presence, rate limits, pub/sub, token replay records, and caches.

Native Arctic rooms will not expose an inbound IRC protocol endpoint in the MVP. External IRC will be a later, isolated outbound connector/bouncer domain and cannot share native message persistence.

## Why this fits the repository

The existing `web` service is a standalone Next.js server behind a Cloudflare connector. Its Route Handlers are short-lived request/response APIs, and `worker` already owns durable background jobs. Long-lived WebSocket state in a normal Next Route Handler would not fit the current health, restart, scaling, or failure boundaries.

`getPrisma()` is already lazy, which is suitable for build-safe code and the future gateway. Existing Auth.js session validation is freshened against `User.authVersion` and `disabledAt`; the gateway must validate a short-lived, server-issued token that carries only a minimal authoritative chat context and must recheck revocation on reconnect.

## Native chat topology

```text
Browser -- HTTPS --> Next.js web/API -- Prisma --> PostgreSQL
   |                                      |
   +-- WSS (Phase 2) --> chat-gateway ---+-- Redis
                                           |
Existing worker -- later chat jobs --------+
```

The browser receives the connection token from an authenticated same-origin Route Handler and provides it only in WebSocket authentication data, never in a URL. The gateway checks the exact permitted origin, signing key, expiry, token ID/replay record, and current session version before joining any room. Every subscription, history request, and send operation authorizes server-side membership.

The chosen realtime library remains intentionally undecided until Phase 2. Socket.IO with a Redis adapter is a candidate because its acknowledgement/reconnect semantics match the plan, but its current compatibility, bundle cost, and deployment model must be reviewed before adding a dependency. The Phase 2 decision record must compare it with a small standards-based WebSocket implementation using the actual hosting/runtime constraints.

## Module layout

Use the current single-package repository. Avoid a workspace/monorepo conversion.

```text
src/app/irc/**                 pages and protected API routes
src/components/irc/**          client-only interactive shell components
src/lib/chat/**                server-safe feature flags, contracts, policies, persistence
services/chat-gateway/**       Phase 2 process, imported/shared contracts only
scripts/bootstrap-chat-rooms.ts  explicit idempotent official-room bootstrap
docs/arcticirc/**              product, audit, security, test, and operations documents
```

Shared contracts must be TypeScript and Zod schemas in a dependency-light `src/lib/chat/contracts.ts`. Client-safe event types should not import `getPrisma`, secrets, or Node-only modules. Gateway services must initialize Prisma and Redis lazily.

## Data-domain rules

- `User`, `Feed`, and `Article` are reused by ID.
- `ChatRoomInterest` stores a canonical Discover interest ID, validated against the runtime directory. It has no foreign key because no reusable topic table exists.
- `ChatProfile`, `ChatRoom`, `ChatRoomMember`, `ChatMessage`, `ChatBlock`, `ChatRoomBan`, `ChatReport`, and chat audit records are additive native-domain models.
- A PostgreSQL-generated or transaction-assigned room-local message sequence plus `(senderUserId, clientMessageId)` uniqueness will provide cursoring and idempotent retry. The exact Prisma/PostgreSQL implementation must be proven in migration tests before shipping.
- External IRC uses a different future `Irc*` model family and never writes native `ChatMessage` records.

## Operational controls

All risk-bearing behaviour is fail-closed behind server-side environment flags. `ARCTIC_IRC_ENABLED` gates native entry; separate flags will gate beta access, guest previews, room creation, direct messages, bot posting, and each external network. The gateway will listen only on the Compose network; the existing public connector/reverse proxy will own WSS routing and upgrade headers. It needs `/live` and `/ready` endpoints, structured redacted logs, and a Compose health check independent from the reader.

## Rejected alternatives

- **WebSocket Route Handler in Next.js:** weak connection lifecycle and outage isolation in this deployment.
- **A full native IRC server in MVP:** adds protocol, identity, and abuse surface before the web product is validated.
- **A second account or topic database:** conflicts with the existing Auth.js identity and Discover taxonomy.
- **External-network bridge into native rooms:** collapses separate consent, moderation, and retention domains.

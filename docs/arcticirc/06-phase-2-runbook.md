# Arctic IRC Phase 2 runbook

## What this phase adds

Phase 2 keeps chat disabled by default, but adds the guarded connection path needed for later native chat UI work:

- `POST /api/chat/profile` creates one stable, normalized handle for an eligible account.
- `POST /api/chat/session` mints a short-lived, signed, single-use connection token only for a verified, current account with a profile.
- `chat-gateway` is a separate Socket.IO service with exact-origin enforcement, a fresh account/profile check, Redis-backed single-use token consumption, and `/live` plus `/ready` probes.

The endpoints emit `Cache-Control: no-store`. Tokens are returned in JSON for the immediate WebSocket handshake only; they must never appear in a URL, room event, audit record, or application log.

## Required configuration

Keep every `ARCTIC_IRC_*` feature flag false until the private-beta approval. Before enabling the gateway profile, generate a separate high-entropy token secret and retain the short default TTL:

```dotenv
ARCTIC_IRC_TOKEN_SECRET=replace-with-a-unique-32-byte-or-longer-secret
ARCTIC_IRC_TOKEN_TTL_SECONDS=60
CHAT_GATEWAY_PORT=3001
```

`ARCTIC_IRC_TOKEN_SECRET` is not interchangeable with `AUTH_SECRET`, `CRON_SECRET`, the database password, or the Redis password.

## Compose and tunnel boundary

The `chat-gateway` Compose service is under the explicit `chat` profile and intentionally has no host port mapping. It is not reachable simply by opening port 3001 on the VPS.

When the beta is approved, first configure the existing trusted tunnel/reverse proxy to forward the canonical browser origin's WebSocket path to `chat-gateway:3001`. Preserve the browser-facing host and HTTPS termination so the gateway can require an exact `Origin` equal to `APP_ORIGIN`. That tunnel configuration is managed outside this repository and is deliberately not changed by this phase.

Start the opt-in service only after that route has been reviewed:

```powershell
docker compose --profile chat up --build -d chat-gateway
```

Do not expose a direct `ports:` mapping for the gateway as a convenience workaround.

## Verification

Run the source checks first:

```powershell
npm run prisma:generate
npx prisma validate
npm test
npm run lint
npm run typecheck
npm run build
```

In the private environment, after the schema migration and official-room bootstrap have succeeded, use a verified test account to create a profile, request one session token, and connect once through the canonical WSS route. Confirm the second use of the same token is rejected, then revoke the account session and confirm a newly minted pre-revocation token is rejected. Finally, leave the chat gateway stopped and confirm ordinary reader pages and `/api/health` remain available.

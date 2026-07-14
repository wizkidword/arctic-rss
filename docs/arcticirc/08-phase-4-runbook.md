# Arctic IRC Phase 4 runbook

## Entry points and gating

`/irc` is a dedicated, browser-first IRC client shell. It remains hidden from the Arctic RSS navigation and resolves to Next.js not-found behavior unless `ARCTIC_IRC_ENABLED=true`.

When enabled:

- unauthenticated visitors are redirected to `/login`;
- verified users without a chat profile receive the first-use handle form;
- unverified accounts receive an explanatory verification screen;
- verified users with a profile receive the client shell.

The Arctic RSS reader navigation adds **Chat** only when the server-rendered feature flag is enabled. Guest navigation never exposes it.

## Client behavior

The shell uses the same-origin REST APIs for joining rooms and loading durable history. It requests a fresh `POST /api/chat/session` token only when the user explicitly connects. The token remains in the Socket.IO handshake payload and is never placed in a route, query string, browser storage, transcript, or UI log.

Socket.IO automatic reconnection is deliberately disabled because Phase 2 tokens are single-use. The **Connect** button obtains a new token for each connection attempt. If the gateway is unavailable, the shell remains usable for its offline/status UI and gives a clear reconnect affordance.

The expected trusted reverse-proxy mapping for a later private environment is the canonical HTTPS host's `/socket.io` WebSocket path to internal `chat-gateway:3001`. Do not add a direct host port to the gateway. That configuration is not included or activated in this phase.

## Keyboard and rendering safeguards

- `Ctrl/⌘ K` focuses the message composer.
- `Enter` sends and `Shift+Enter` adds a line break.
- User message text is rendered as ordinary React text; no chat content is injected as HTML.
- The compact mobile shell exposes the room tree through a drawer. Desktop keeps the server tree, tabs, transcript, and participant panel visible together.

## Manual private-environment verification

After the Phase 1 migration, room bootstrap, Phase 3 gateway, and trusted WSS proxy route are available in a non-production environment:

1. Enable only `ARCTIC_IRC_ENABLED` for verified test accounts.
2. Open `/irc` and create a handle with a new account.
3. Join `#ai`; confirm a tab, topic, and history appear.
4. Press **Connect** and confirm the status becomes online through the canonical site host.
5. Send a message from two separate browser sessions; confirm timestamps, handles, and cross-client delivery.
6. Disconnect the gateway; confirm the Reader continues to load and `/irc` explains the offline state.
7. Reconnect using **Connect**; confirm a fresh token is issued and retained history is restored.
8. Check the mobile drawer, `Ctrl/⌘ K`, keyboard send behavior, and all four local visual themes.

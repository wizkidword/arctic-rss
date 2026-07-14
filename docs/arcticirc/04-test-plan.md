# Arctic IRC test plan

## Quality gate

Every phase runs the applicable focused tests, then the repository regression suite:

```powershell
npm run prisma:generate
npm test
npm run lint
npm run typecheck
npm run build
```

Run `npm run test:e2e` when a browser-visible route or interaction changes. The project uses Vitest for unit/integration-style tests and Playwright for `e2e/**`; the existing Playwright server starts `npm run dev` at `127.0.0.1:3000`.

## Phase coverage

### Phase 1

- Boolean flag parsing defaults disabled for absent, malformed, and explicit false values.
- Handle normalization: trimming, case folding, allowed character set, length, reserved names, and collision behavior.
- Room-slug normalization: optional leading `#`, lowercase ASCII rules, length, and reserved names.
- Canonical interest validation against composed Discover data, including static and dynamic directory entries.
- Complete global and room permission matrix for user/admin and member/owner/admin/operator/voice roles.
- Official-room bootstrap is idempotent, validates linked interest IDs, and never mutates unrelated data.

### Phases 2–3

- Valid, expired, forged, revoked, and replayed chat-token tests.
- Verified/disabled/stale-session entry tests.
- Room join/leave, ban rejection, authorization on every history/subscription path, idempotent sends, cursor pagination, reconnect catch-up, and no cross-room fan-out.
- Rate-limit failure and Redis-unavailable tests; messages persist before acknowledgement.

### User interface and later product work

- Component tests for escaped text, status/permission states, keyboard controls, responsive drawers, unread/mention badges, and reconnect/offline state.
- Playwright flows with two browser contexts: login, first profile, discover, join, send/receive, refresh/history, article share, report, and moderation.
- Accessibility checks: focus order, semantic controls, role text not color-only, reduced motion, and mobile tap targets.
- Security adversarial cases: XSS payloads in all text fields, oversized inputs, cross-origin gateway attempt, forged role claims, floods, and unsupported commands.

### External IRC gate

Use only a controlled test IRC server before any approved owner-only network smoke test. Cover per-user isolation, TLS validation, reconnect backoff, kill-switch disconnect, credential redaction, and proof that external traffic never enters native message storage.

## Manual verification after gateway work

1. Confirm the reader remains usable with the gateway stopped and `ARCTIC_IRC_ENABLED=false`.
2. Confirm the feature flag hides entry points and rejects direct API/session requests.
3. In two isolated browser sessions, verify that a message, member list, and unread marker never leak across rooms.
4. Inspect structured logs for absence of message bodies, credentials, cookies, and tokens.
5. Verify the Compose health/readiness endpoints and reverse-proxy WSS upgrade only after the service is internal and authenticated.

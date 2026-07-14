# Phase 11 — Privacy, security, accessibility, and policy gates

## Implemented controls

- Every state-changing native-chat REST route now requires an exact `Origin`
  match to `APP_ORIGIN` before account lookup or mutation. Missing or cross-site
  origins fail closed. This covers profile changes, session-token issuance,
  room membership/topic/article actions, reports, moderation, blocks, and
  ArcticBot settings.
- The Socket.IO gateway already checks the exact allowed origin during its
  separate handshake. The REST origin check is not a substitute for that
  gateway control.
- Native chat messages render as text. Article cards use internal IDs and do
  not render supplied HTML. The existing image proxy and sanitizer remain the
  only browser-facing handling path for third-party reader content.
- Generic link previews are intentionally not enabled. Do not add a preview
  fetch to a route handler or browser client. Any later preview feature must use
  the repository's URL-safety controls in a dedicated worker.

## CSP and future reverse-proxy boundary

The current CSP is report-only. Its report endpoint stores no full path, query,
cookie, token, or reader data. Observe the existing CSP runbook before changing
it to enforcement:

- [Browser content-security runbook](../operations/browser-content-security-runbook.md)

The gateway is still internal and has no host port. When a private beta is
approved, the trusted HTTPS terminator must route only the canonical host's
`/socket.io` WebSocket path to `chat-gateway:3001` on the Compose network.
It must preserve HTTPS and the browser-facing host so the gateway can require
the exact `APP_ORIGIN` value.

Do not:

- publish port `3001` on the host;
- proxy arbitrary paths to the gateway;
- use a wildcard `connect-src` CSP directive;
- route a different hostname to the gateway;
- add an external IRC connector route.

Only after the exact private route is tested should the CSP observation policy
be updated with the precise same-origin WebSocket requirement. Record the
canonical host and path in the deployment runbook; do not encode a speculative
host into application code today.

## Retention and deletion requires owner approval

No native chat retention job is enabled in this phase. The plan's 90-day window
is an example, not an approved promise. Before adding a deletion worker or
publishing related Privacy/Terms/Cookies/Security language, the owner must
approve all of the following:

1. Default room message retention and whether deleted-message tombstones remain.
2. Separate retention/access rules for reports, evidence snapshots, and audit
   records.
3. Account deletion treatment for authored messages: delete, anonymize, or a
   documented mixed model.
4. Room archive/deletion treatment and backup-retention period.
5. The reviewed legal language that matches those decisions.

Until then, existing chat fields and records are preserved. This avoids an
irreversible deletion behavior or a public policy promise that does not match
the running system.

## Accessibility checklist for native chat

Run this checklist with chat enabled only in a controlled local or private
environment:

1. Reach room selection, Connect, composer, reporting, Hide ArcticBot, and
   Disable ArcticBot in a logical Tab order.
2. Confirm Enter submits only through the explicit composer form behavior and
   Tab completes a command without trapping keyboard focus.
3. Verify visible focus on buttons, links, the room selector, and the composer.
4. Confirm status notices and report results are announced without reading full
   chat history repeatedly.
5. Check small-screen room controls, long titles, article cards, and 200% zoom.
6. Confirm that hiding ArcticBot affects only local presentation and does not
   mutate retained messages.
7. Use a screen reader to verify transcript timestamps, sender labels, the
   explicit `<ArcticBot>` label, and report controls have understandable names.

## Deliberately deferred

- Owner-approved updates to Terms, Privacy, Cookies, and Security.
- Retention/deletion worker and migration settings.
- A safe-link-preview worker (no generic previews exist).
- Any production proxy, Docker, migration, or external IRC activation.

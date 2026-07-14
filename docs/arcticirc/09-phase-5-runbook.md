# Arctic IRC Phase 5 runbook

## Command safety boundary

`src/lib/chat/commands.ts` accepts only Arctic's typed command vocabulary. It normalizes handles and room slugs, validates durations and command text, and never produces a raw server line. Unknown commands, malformed commands, and `/raw` are rejected before any request or socket event is issued.

The client offers Tab completion for command names and Up/Down command history. `/clear` updates a browser-local room set only; it does not call a history or message API, and the next realtime message restores the visible transcript.

## Active commands

- `/join`, `/part`, `/me`, `/nick`, `/topic`, `/whois`, and `/rooms` use structured REST or Socket.IO operations.
- `/ignore` and `/unignore` persist a `ChatBlock` record through the authenticated chat API and hide matching handles in the current shell.
- `/help` is available inside the shell and at `/irc/help` when chat is enabled.

`/topic` is permission-checked by `canPerformChatAction("UPDATE_TOPIC", ...)` in the service layer. A browser cannot grant itself the operator role.

## Deferred sanctions

`/invite`, `/kick`, `/ban`, `/unban`, and `/mute` are parsed as typed commands but intentionally report that they are unavailable. There is no invitation persistence model or audited moderation-command workflow yet. Activating them requires the later moderation phase to provide durable sanctions, audit events, role-aware endpoints, and live room updates. They must not be implemented by relaying command strings or trusting client role claims.

## Verification

Run:

```powershell
npm test -- --run src/lib/chat/commands.test.ts src/lib/chat/blocks.test.ts src/lib/chat/profiles.test.ts src/lib/chat/room-service.test.ts services/chat-gateway/native-chat.test.ts src/components/irc/irc-client-shell.test.tsx
npm run typecheck
npm run lint
npm run build
```

Manual browser verification remains gated on the Phase 1 migration, room bootstrap, and trusted same-origin Socket.IO proxy being enabled in a non-production environment. Do not apply the migration, bootstrap rooms, add the proxy route, or start the Compose chat profile as part of this phase.

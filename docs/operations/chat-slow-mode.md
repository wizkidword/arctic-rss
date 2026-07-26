# Atomic chat slow mode

Slow mode is a durable, per-room, per-user cooldown. It is enforced by the
database rather than gateway process memory, so every chat gateway replica
uses the same limit.

For a room with a positive `slowModeSeconds` value, a normal message or
article share conditionally advances `ChatRoomMember.nextMessageAllowedAt` only
when the current cooldown is absent or expired. The conditional update, message
insert, and room `lastActivityAt` update run in one PostgreSQL transaction.
If any later write fails, the cooldown update rolls back with it.

Application administrators are exempt. Room owner, room administrator, and
room operator roles are intentionally not exempt: they remain subject to slow
mode unless they are also application administrators. This avoids a role-based
path that could bypass a room's anti-flood setting.

The transactional chat-event outbox is intentionally introduced by
`CHAT-OUTBOX-001`, after its moderation-path prerequisite. Until then, live
publication remains a post-commit Redis publication and durable reconnect
catch-up remains the source of truth.

# Transactional moderation paths

This inventory records the moderation mutations ArcticIRC currently exposes and
the durability guarantees each one has. It is the implementation review for
`CHAT-MOD-003`.

## Supported actions

| Action                             | Durable state and audit            | Fresh authorization                 | Retry protection                   | Immediate external effect             |
| ---------------------------------- | ---------------------------------- | ----------------------------------- | ---------------------------------- | ------------------------------------- |
| Kick                               | One transaction                    | Fresh chat user and room permission | Required `Idempotency-Key` receipt | Membership-removal Redis event        |
| Ban                                | Advisory lock plus one transaction | Fresh chat user and room permission | Required receipt                   | Membership-removal Redis event        |
| Unban                              | One transaction                    | Fresh chat user and room permission | Required receipt                   | None today                            |
| Mute                               | One transaction                    | Fresh chat user and room permission | Required receipt                   | None today                            |
| Lock, slow mode, suspend room      | One transaction                    | Fresh chat user and room permission | Required receipt                   | Suspension publishes room-close event |
| Resolve report                     | One transaction                    | Fresh administrator                 | Required receipt                   | None today                            |
| Create, review, release legal hold | Advisory lock plus one transaction | Fresh administrator                 | Required receipt                   | None today                            |

The receipt is stored in `ChatModerationAction` in the same PostgreSQL
transaction as the state mutation and its audit row. Reusing a key with a
different action or payload returns `409`; repeating the same request returns
the original response without another audit row or a new mute deadline.

Clients send a new opaque UUID in the `Idempotency-Key` header for each
deliberate action. A transport retry must reuse that header value and the same
body.

## Not currently exposed

ArcticIRC has no user-facing native message delete/restore endpoint, role
change endpoint, or room reopen endpoint. The local `/clear` command only
clears the caller's transcript; it does not alter retained server history.
Those operations must be added with the same state/audit/receipt contract
before they are exposed.

## Event delivery boundary

Kick, ban, and room-close notifications are currently published immediately
after their database transaction. The next milestone, `CHAT-OUTBOX-001`, moves
those publications to a transactional outbox so a Redis outage cannot lose an
event after a committed moderation action. No report evidence or legal-hold
content may enter that outbox payload.

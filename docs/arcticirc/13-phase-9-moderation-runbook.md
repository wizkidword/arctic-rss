# Arctic IRC Phase 9 moderation runbook

## Implemented controls

Native Arctic rooms now have server-authorized reporting and essential room
moderation controls. The existing `/ignore` and `/unignore` controls remain
user-scoped blocks; they do not affect other members or moderation records.

| Capability | Entry point | Authority | Result |
| --- | --- | --- | --- |
| Report a message or room | IRC report dialog; `POST /api/chat/reports` | Eligible room member | Restricted report, immutable versioned evidence snapshot, and audit row |
| View open reports | `/admin/chat-reports`; `GET /api/chat/reports` | Fresh application admin | Open/reviewing queue only; every non-empty evidence review is audited |
| Kick | `/kick`; `POST .../moderation/kick` | Operator or higher, hierarchy checked | Target membership leaves; target socket leaves the room |
| Ban / unban | `/ban`, `/unban`; `POST .../moderation/ban` or `unban` | Operator or higher, hierarchy checked | Durable ban / revocation; banned target loses live room subscription |
| Mute | `/mute`; `POST .../moderation/mute` | Operator or higher, hierarchy checked | Future sends and article shares reject until `roomMutedUntil` |
| Slow mode | `PATCH .../moderation/settings` with `slow-mode` | Operator or higher | Bounded 0–3600 second durable setting, enforced on sends and article shares |
| Lock / read-only | `PATCH .../moderation/settings` with `lock` or `state` | Operator or higher | New joins require invite; or non-admin posting stops |
| Suspend room | `PATCH .../moderation/settings` state `SUSPENDED` | Application admin only | REST permission checks fail for ordinary members and all subscribed sockets leave the room |

Every report and moderator action writes an append-only `ChatAuditLog` row in
the same database transaction as its durable state change. Evidence is created
inside the report transaction, carries a SHA-256 content hash and schema
version, and is blocked from in-place updates at the database layer. Audit
metadata contains bounded operational fields (action/category/duration/state),
never message body, report details, credentials, cookies, or subscriptions.

## Report privacy and authorization

The reporter must currently be allowed to read the reported room. A message
report resolves the message only after this room-access check, then captures
only the evidence needed for adjudication: sanitized message text, identifier,
sequence/version and timestamps, sender/room snapshots, limited reply context,
and relevant article-share metadata. A caller cannot use the report endpoint
to retrieve another room's text, membership, or history.

Report category, details, and evidence are restricted to freshly authorized
application admins. They are not included in public directory, room, socket,
analytics, or log payloads. Normal message retention can remove the original
message without removing its report evidence; evidence follows the report's
existing retention class and any scoped legal hold. This operational control
does not publish a new public retention promise.

## Delivery and enforcement

Kick, ban, and room-suspension changes publish small internal Redis events.
The gateway validates each event and removes only the matching socket(s) from
the native room channel. Even if a stale socket remains briefly during a Redis
failure, durable send, join, and history access checks still reject the action
at the service boundary.

## Not yet enabled

- Chat-specific global account sanctions: this needs an additional policy and
  additive model that does not accidentally disable the reader account.
- Report assignment and appeal workflow.
- Delete-message/operator UI for slow mode, lock, read-only, and suspension
  (the protected REST API is present).
- Production migration, room bootstrap, Docker/reverse-proxy activation, or
  public/external IRC connection.

## Verification

Run without enabling chat, applying a migration, or starting infrastructure:

```powershell
npm run prisma:generate
npm test
npm run lint
npm run typecheck
npm run build
```

For later controlled staging verification, use three accounts: member,
operator, and admin.

1. Have the member report a message and confirm the fresh-admin queue shows a
   version-2 immutable evidence record with the sanitized message text and
   content hash.
2. Confirm a nonmember cannot report a guessed message ID from another room.
3. Delete or expire the reported message, then confirm the admin can still
   review its evidence and that the review is audited without exposing it to a
   public API.
4. Confirm an operator cannot act on an equal/higher role, but can mute, kick,
   and ban a lower-role member with an audit row for each.
5. Confirm muted and slow-mode members cannot send messages or article shares.
6. Confirm a kicked/banned member's open browser session stops receiving room
   events and cannot post, rejoin, or fetch history.
7. Confirm an admin room suspension removes all live room subscriptions while
   leaving the RSS reader available.

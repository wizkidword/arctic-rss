# Chat database role runbook

## Purpose and ownership

`chat-gateway` uses `CHAT_DATABASE_URL`, a dedicated PostgreSQL login created
by [`ops/postgres/bootstrap-chat-runtime-role.sql`](../../ops/postgres/bootstrap-chat-runtime-role.sql).
That role is for the gateway's narrow live-chat path only: identity
revalidation, room and membership snapshots, normal-message creation, read
markers, and event-outbox writes. It can show a shared article's title and its
publisher's title, but cannot read article bodies.

The controlled PostgreSQL schema owner runs this bootstrap after the one-shot
`migrate` service has completed. The `migrate` service remains the only
schema-owning application path. Prisma migrations must not create login roles,
alter role memberships, or grant runtime permissions.

The bootstrap is idempotent: it creates the named login if absent, applies its
current password, revokes all broader database/schema/table/sequence rights,
then reapplies the reviewed minimum grants. It accepts `chat_role` and
`chat_password` as `psql` variables; do not paste a real password into source,
shell history, tickets, logs, or this runbook.

## Provision or change the role

1. Complete the selected release's database migration with the controlled
   schema owner. Do not run this as the chat runtime role.
2. Generate a unique high-entropy password through the approved private
   secret-management path. Set the private production `CHAT_DATABASE_URL` to
   use the dedicated chat login; do not set `DATABASE_URL` on `chat-gateway`.
3. From the controlled owner session, run the bootstrap with its non-echoed
   `psql` variables. Confirm it exits successfully. It must not be placed in a
   Prisma migration or the application's startup command.
4. Run the source checks (`npm run compose:verify-env` and
   `npm run db:verify-chat-role`) in the reviewed checkout. The latter proves
   the bootstrap's allowed and denied SQL behavior using a disposable database,
   not a production credential.
5. Only as part of an owner-approved release, recreate the chat gateway with
   the new `CHAT_DATABASE_URL`, then verify internal/public readiness, login,
   and a normal chat message/read-marker flow. A source check does not
   authorize this production action.

## Rotation and review

Rotate the role password by repeating the provision procedure with a new
private password and updating `CHAT_DATABASE_URL` in the same approved
release. Keep the old release as the rollback candidate until the new gateway
has passed the selected-topology checks. Do not broaden the role temporarily
to work around a failing gateway query.

When a gateway query, model field, or chat capability changes, first identify
its exact SQL columns and operations. Update the bootstrap and the disposable
role test together, adding both a working allowed-path assertion and a denied
assertion for anything that must remain unavailable. Review role memberships
as well: this login must not inherit a broader application, migration, or
administrative role.

The current role has no privilege to read article bodies, passwords,
password-reset or account-deletion confirmation hashes, AI usage/provider
data, broad moderation or reporting records, or to update account plan/role
fields or execute schema DDL. Those boundaries need a separate design review
before any change.

# Service-role environment boundaries

`config/service-role-environments.json` is the single source of truth for
runtime service environments. It defines the exact Compose environment for
each service, required settings, infrastructure-owned settings, and known
aliases or host-only deployment inputs.

At production startup, web, worker, and chat-gateway processes fail closed
when a known managed variable is present but is not allowed for their active
role. This includes migration and tunnel aliases, legacy Redis inputs, database
and Redis container credentials, and Compose image or port inputs. The error
names only the variable and role; it never logs its value.

Ordinary process settings such as `PATH`, `HOME`, and the Node runtime version
are not application-managed variables and remain allowed.

## Chat gateway database boundary

The chat gateway receives `CHAT_DATABASE_URL`, not `DATABASE_URL`. It connects
as a separate login that can perform the narrow socket authorization, room,
membership, normal-message, and event-outbox operations used by that process.
It may display an article share's ID, title, and publisher, but cannot read
article bodies, account passwords or confirmation tokens, AI data, or broad
chat administration/reporting data. It also cannot change plans or roles, or
perform schema DDL. The controlled owner applies and rotates that login using
the [chat database role runbook](chat-database-role-runbook.md); migrations do
not create it.

## Temporary Redis compatibility

`REDIS_URL` and `ARCTIC_RSS_ALLOW_LEGACY_REDIS_URL_FOR_MIGRATION` are declared
as runtime-only compatibility aliases. They are not injected by normal Compose
service environments. A process that receives them still needs the explicit
migration flag and must pass the existing Redis validation; there is no silent
fallback. Retire these aliases according to
[legacy-redis-compatibility-retirement.md](legacy-redis-compatibility-retirement.md).
The chat gateway is intentionally excluded: it always requires its explicit
ephemeral Redis ACL URL, so a one-Redis compatibility alias is not a legitimate
runtime input for that role.

## Operator checks

Before an approved release, run:

```bash
npm run compose:verify-env
npm run doctor -- release --role web
npm run db:verify-chat-role
```

The first command verifies rendered Compose service environments exactly match
the manifest. The second reports required variable names and the production
security-boundary result without exposing values. The last command uses a
disposable PostgreSQL instance to prove the chat role's allowed and denied SQL
behavior. None of these commands authorizes a production change.

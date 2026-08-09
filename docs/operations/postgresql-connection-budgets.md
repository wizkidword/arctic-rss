# PostgreSQL connection budget

## Purpose

This document is the human-readable companion to
[`config/database-connection-budget.json`](../../config/database-connection-budget.json).
The JSON file and `npm run db:connection-budgets:verify` are authoritative for
the numeric checks. The values describe the source configuration only; they do
not claim a production measurement or authorize a release.

## Fixed server ceiling

Compose starts PostgreSQL with `max_connections=100`.

| Allocation | Connections | Why it is kept out of application pools |
| --- | ---: | --- |
| Superuser and admin reserve | 8 | Keeps a private operator path available during an incident. |
| Migration and recovery reserve | 4 | Separates one-shot schema/recovery work from normal service pools. |
| Monitoring reserve | 3 | Leaves capacity for the host and database observations. |
| **Application pool budget** | **85** | The maximum combined runtime pool capacity. |

The reserves total 15, so `100 - 15 = 85` application connections. The
one-shot `migrate` service is accounted for inside the four-connection
migration/recovery reserve; it is not an application Prisma pool.

## Per-role limits

Each listed runtime service receives its own `DB_POOL_MAX` and
`DB_APPLICATION_NAME` in Compose. Startup rejects a larger pool, a malformed
timeout, or a name that does not match the role.

| Role | Pool maximum | PostgreSQL application name |
| --- | ---: | --- |
| `web` | 6 | `arctic-rss-web` |
| `worker-all` | 6 | `arctic-rss-worker-all` |
| `worker-ingestion` | 4 | `arctic-rss-worker-ingestion` |
| `worker-ai-mail` | 3 | `arctic-rss-worker-ai-mail` |
| `worker-imports` | 2 | `arctic-rss-worker-imports` |
| `worker-maintenance` | 2 | `arctic-rss-worker-maintenance` |
| `worker-health` | 2 | `arctic-rss-worker-health` |
| `worker-chat-events` | 2 | `arctic-rss-worker-chat-events` |
| `chat-gateway` | 4 | `arctic-rss-chat-gateway` |
| `migrate` release allocation | 1 of 4 reserve slots | Not a Prisma-adapter pool |

The Prisma-backed services use a 3-second acquisition deadline, a 10-second
idle-client timeout, and a 15-second PostgreSQL statement timeout by default.
Production startup accepts only these safe ranges: 250–10,000 ms acquisition,
1,000–60,000 ms idle, and 1,000–60,000 ms statement timeout. The one-shot
Prisma CLI migration path does not use this adapter; it is deliberately
accounted for in the separate recovery reserve and must be observed in an
owner-approved disposable release rehearsal before a production claim.

## Topology calculations

The application maximums below come directly from the enabled service roles.
“Overlap plus one worker restart” is the conservative test case: two release
sets are momentarily present and the largest enabled worker starts once more.
These values exclude the separately reserved migration/recovery, admin, and
monitoring slots.

| Topology | Normal application pools | Normal plus migration | Old/new overlap | Overlap plus one worker restart | Restart plus migration | Within budget? |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `all-in-one` | 14 | 15 | 28 | 34 | 35 | Yes |
| `all-in-one-with-chat` | 18 | 19 | 36 | 42 | 43 | Yes |
| `split` | 19 | 20 | 38 | 42 | 43 | Yes |
| `split-with-chat` | 25 | 26 | 50 | 54 | 55 | Yes |

With the one migration connection running, the largest conservative case uses
54 application connections plus 1 migration/recovery connection. That fits
inside the 89 connections available after holding back the 8 admin and 3
monitoring slots, while the remaining 3 migration/recovery slots stay
available. The verification script fails if a rendered Compose service,
topology manifest, or future pool edit makes any scenario exceed its documented
budget.

## Runtime evidence

The database pool emits privacy-safe structured events. Startup records the
role, application name, configured maximum, timeouts, and available active/idle
counts. A wait of at least 100 ms records `database_pool_wait`; an acquisition
deadline records `database_pool_acquisition_timeout`. Connection creation and
idle-pool errors are also recorded without a database URL, credential, SQL,
or user data.

Before an owner-approved release, run:

```bash
npm run db:connection-budgets:verify
npm run compose:verify-env
```

These checks inspect local source and rendered Compose configuration only. They
do not start services, access production, or prove a deployed connection count.

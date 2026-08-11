# ADR 0003: account-scoped mobile offline storage

**Status:** accepted for sixth-pass source work.

## Decision

Use one SQLite database with a mandatory owner metadata row. Every cache,
cursor, download, and pending mutation operation verifies the authenticated
owner before reading or writing. A missing token, failed SecureStore read,
account switch, logout, or restored database without current credentials
purges inaccessible account content before it can render.

Pending mutations carry the owner identity and cannot replay after an account
switch. Android Auto Backup excludes the local database and downloaded bodies;
the implementation must assert the generated native configuration. Signed-out
deep links use the normal browser-login boundary and cannot hydrate cache data.

## Rationale and consequences

One explicit owner boundary makes account switching, schema upgrades, and
restore behavior testable without multiplying database files. SecureStore and
SQLite are not assumed to fail together, so incomplete or restored state is
treated as unowned rather than as recoverable reader content.

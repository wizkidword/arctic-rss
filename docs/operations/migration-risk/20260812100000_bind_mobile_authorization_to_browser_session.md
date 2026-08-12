# Migration risk record: bind mobile approval to the browser session

Migration name: `20260812100000_bind_mobile_authorization_to_browser_session`

Migration SQL SHA-256: `01ef5d511d1cce3454513d746a3a8acc2280b861af1c00ed2eda56037b883fb4`

Author/date: Seventh-pass Phase 4 source implementation; 2026-08-12
Affected tables: `MobileAuthorizationRequest`.
Measured row counts: Fresh disposable PostgreSQL rehearsal started empty; production pending-authorization cardinality must be captured during an approved release review.
Measured table and index sizes: Fresh disposable PostgreSQL rehearsal contained schema only; capture production `MobileAuthorizationRequest` table/index sizes before an approved release.
Expected lock type: The short pending-row delete and `ALTER TABLE ... ADD COLUMN ... NOT NULL` require an exclusive table lock.
Rewrite or scan risk: The migration deletes only expiring pending authorization requests and adds a required column after that bounded compatibility reset; it does not rewrite user content or credential-session tables.
Expected duration: Fast on the empty disposable rehearsal; production duration depends on current lock contention and pending authorization rows.
Online-safe strategy: Apply only through the approved release controller after fresh backup, active-transaction, table-size, and lock evidence. Stop instead of waiting behind a blocking lock.
Backfill plan: None. Older pending approvals cannot be safely bound to a browser session and are intentionally invalidated; users restart authorization safely.
Validation plan: A disposable PostgreSQL rehearsal applies all migrations, reports no drift, and runs the mobile authorization integration suite. Re-run exact-commit CI and capture release-window evidence before production.
Maintenance mode required: No dedicated maintenance mode; the approved bounded migration lock window is required.
Rollback feasibility: Preserve the browser-session binding and repair forward. Do not recreate pending approvals or synthesize a session hash.
Forward-recovery plan: Inspect Prisma migration state and the approval table, preserve completed authorization/session evidence, and require a new browser approval after a forward repair.
Backup evidence ID requirement: The approved release must record the exact fresh structured backup evidence ID before migration execution.
Approver: Not granted for production execution; exact `DEPLOY <short-sha>` approval remains required.
Approval timestamp: Not recorded because production ready is false.
Production ready: false
Production result: Not executed in production; this record covers source and disposable-fixture verification only.

Affected table: `MobileAuthorizationRequest`.

Risk: the new `browserSessionHash` column is required. Pending approvals issued
by older code cannot be safely bound retroactively, so the migration deletes
only those short-lived pending rows before adding the column. It does not touch
authorization codes, refresh tokens, sessions, stable-device data, or user
content.

Online strategy: run only through the approved release procedure after fresh
backup, active-transaction, and lock evidence. The deletion and `ALTER TABLE`
need a brief exclusive lock; stop rather than wait behind a blocking lock.

Recovery: after this migration, preserve the column and repair forward. Do not
recreate pending approvals or synthesize a browser-session hash. Users can
restart the authorization flow safely.

Verification: a disposable PostgreSQL rehearsal must apply all migrations,
report no drift, and run the mobile authorization integration suite. Production
approval is not granted by this record.

# Migration risk record: one active OPML import per user

Migration name: `20260808230000_enforce_one_active_opml_import_per_user`
Migration SQL SHA-256: `dce08036146274c0b0a29196665e63db38bf1aa174825b0db570a03ce750ca03`
Author/date: Fourth-pass implementation; 2026-08-08
Affected tables: `ImportJob`
Measured row counts: Not measured in this worktree; obtain the current production count and count of duplicate active imports only during an approved release review.
Measured table and index sizes: Not measured in this worktree; obtain current production table and index sizes only during an approved release review.
Expected lock type: A regular PostgreSQL `CREATE UNIQUE INDEX` takes a SHARE lock that permits reads but blocks concurrent writes while the index builds. The preceding duplicate check is read-only.
Rewrite or scan risk: The index build scans `ImportJob` but does not rewrite table rows. The migration intentionally fails before creating the index if any user already has more than one active (`PENDING` or `PROCESSING`) import.
Expected duration: Fast in the disposable PostgreSQL rehearsal. Measure production table size, lock wait, and duplicate count before an approved execution.
Online-safe strategy: The partial unique index is the authority for the active-job invariant. This normal Prisma migration uses a transaction-compatible non-concurrent index, so production execution needs an explicit low-write-window decision after measuring the table.
Backfill plan: No backfill. Resolve each pre-existing duplicate active import deliberately before the migration; do not have migration SQL choose or cancel a user import automatically.
Validation plan: The disposable PostgreSQL 17.10 verification applies all migrations, confirms the exact partial unique index, admits only one same-process start, admits only one separate `psql` client-process start, verifies pending and processing blocking, verifies terminal completion and failure, verifies cancel-and-retry transitions, and confirms different users do not block one another.
Maintenance mode required: No for the current disposable rehearsal. Decide from fresh production lock and table measurements during an approved release review; a low-write window may be required for a material `ImportJob` table.
Rollback feasibility: High at the application level because the application maps the database conflict to its existing active-import message. Do not drop the index as an emergency response; correct application behavior or resolve the affected job explicitly.
Forward-recovery plan: If production preflight finds duplicate active jobs, stop before migration and resolve those jobs through a reviewed, user-preserving procedure. If index creation fails, keep the compatible application release and investigate without retrying blindly.
Backup evidence ID requirement: The approved release must capture the exact fresh structured backup evidence ID before any migration execution.
Approver: Not granted for production execution. A later release requires the exact `DEPLOY <short-sha>` approval after the normal gates.
Approval timestamp: Not recorded because production ready is false.
Production ready: false
Production result: Not executed. This record covers checked-in migration SQL and a disposable PostgreSQL rehearsal only.

## SQL evidence

- The machine-checked `Migration SQL SHA-256` field above is calculated from
  the committed UTF-8 migration SQL.
- Classifier expectation: `NON_CONCURRENT_INDEX`. The partial unique index is
  intentionally a normal Prisma-compatible index; it requires the production
  lock-window decision documented above.

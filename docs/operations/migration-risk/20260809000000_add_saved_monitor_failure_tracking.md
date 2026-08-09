# Migration risk record: saved monitor failure tracking

Migration name: `20260809000000_add_saved_monitor_failure_tracking`
Migration SQL SHA-256: `1a69349dc281172b942458b8535b8147245e2ed5bda013878fb6ee3a63814c41`
Author/date: Fourth-pass implementation; 2026-08-09
Affected tables: `SavedSearch`
Measured row counts: Not measured in this worktree; obtain the current production `SavedSearch` count during an approved release review.
Measured table and index sizes: Not measured in this worktree; obtain the current production table and index sizes during an approved release review.
Expected lock type: PostgreSQL `ALTER TABLE ... ADD COLUMN` takes an ACCESS EXCLUSIVE lock while the metadata change is applied.
Rewrite or scan risk: The non-null integer has a constant default, so supported PostgreSQL versions can apply it as metadata without a table rewrite; verify the production server version and lock wait before execution.
Expected duration: Fast in the disposable PostgreSQL rehearsal. Measure production lock wait and table size before an approved execution.
Online-safe strategy: The additive column has a safe default of zero and existing monitor scheduling remains compatible until the new worker is released. Execute only after the normal release preflight confirms a suitable write window.
Backfill plan: No backfill. Existing monitors begin with zero consecutive failures, while their existing `monitorLastRunAt` remains the last successful run and `monitorNextRunAt` remains the next eligible attempt.
Validation plan: Apply all migrations to a disposable PostgreSQL database, run the saved-monitor retry tests, and confirm the worker build. Before production execution, capture fresh table size, lock-wait evidence, and a backup evidence ID.
Maintenance mode required: No for the disposable rehearsal. Decide from fresh production lock and table measurements during an approved release review.
Rollback feasibility: High at the application level because zero is the default and the previous worker ignores the additive column. Do not drop the column during an incident; roll forward with a reviewed correction if needed.
Forward-recovery plan: If the migration cannot acquire its lock, stop and retry only through the approved release procedure after investigating active writes. If the new worker finds a data issue, leave the monitor's existing next-run lease intact and correct the schedule with a reviewed follow-up.
Backup evidence ID requirement: The approved release must capture the exact fresh structured backup evidence ID before any migration execution.
Approver: Not granted for production execution. A later release requires the exact `DEPLOY <short-sha>` approval after the normal gates.
Approval timestamp: Not recorded because production ready is false.
Production ready: false
Production result: Not executed. This record covers checked-in migration SQL and local verification only.

## SQL evidence

- The machine-checked `Migration SQL SHA-256` field above is calculated from
  the committed UTF-8 migration SQL.
- Classifier expectation: `NON_NULL_ADDITION`. The additive column has a
  constant default, but it is still treated as a production lock-window
  decision.

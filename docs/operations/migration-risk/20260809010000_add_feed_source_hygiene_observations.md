# Migration risk record: feed source hygiene observations

Migration name: `20260809010000_add_feed_source_hygiene_observations`
Migration SQL SHA-256: `9e822b91de12bf339b7ca9e0471f44d2cd05d92e22d4428c09c4f0d763020bb5`
Author/date: Fourth-pass implementation; 2026-08-09
Affected tables: `Feed`; `FeedSubscription`
Measured row counts: Not measured in this worktree; obtain current production `Feed` and `FeedSubscription` counts only during an approved release review.
Measured table and index sizes: No index is added. Current production table sizes and lock wait must be measured only during an approved release review.
Expected lock type: PostgreSQL `ALTER TABLE ... ADD COLUMN` takes a brief ACCESS EXCLUSIVE metadata lock on each affected table.
Rewrite or scan risk: No. All ten fields are nullable, have no default, no generated expression, no constraint, and no index; PostgreSQL does not need to rewrite or scan existing rows.
Expected duration: Metadata-only in a disposable PostgreSQL rehearsal; measure production lock wait and table sizes before an approved execution.
Online-safe strategy: Expand-only compatible release. Existing code ignores the nullable fields. The new reader records source evidence during normal refreshes and preserves a prior URL only when an explicitly confirmed replacement succeeds.
Backfill plan: No proactive backfill. Existing sources start with unknown hygiene evidence; future safe fetches and feed parses populate only observations they can verify.
Validation plan: Passed in a disposable loopback PostgreSQL 17.10 container: all 42 committed migrations, including this one, applied successfully and `prisma migrate status` reported the schema up to date. Focused redirect, feed-metadata, refresh, subscription, attention-view, and action tests passed; full typecheck, test suite, and production build also passed. Before production execution, capture fresh table sizes, lock-wait evidence, and a backup evidence ID.
Maintenance mode required: No for the nullable expand migration itself, subject to the owner reviewing fresh production lock and table measurements during an approved release review.
Rollback feasibility: High at the application level because previous application versions ignore the added nullable fields. Do not drop populated columns during an incident; retain the compatible schema and use a reviewed forward repair if necessary.
Forward-recovery plan: If the migration cannot acquire its lock, stop and retry only through the approved release procedure after investigating active writes. If source-hygiene evidence is incorrect, leave subscriptions intact and repair application logic in a reviewed follow-up; do not run an unbounded SQL update.
Backup evidence ID requirement: The approved release must capture the exact fresh structured backup evidence ID before any migration execution.
Approver: Not granted for production execution. A later release requires the exact `DEPLOY <short-sha>` approval after the normal gates.
Approval timestamp: Not recorded because production ready is false.
Production ready: false
Production result: Not executed. This record covers checked-in migration SQL and local verification only.

## SQL evidence

- The machine-checked `Migration SQL SHA-256` field above is calculated from the committed UTF-8 migration SQL.
- Classifier expectation: no recognized high-risk pattern; the record is retained because even a metadata-only schema change needs an explicit production lock and rollback decision.

# Migration risk record: source refresh leases and item generations

Migration name: `20260809152000_add_source_refresh_leases`
Migration SQL SHA-256: `31bcf923c455df57c1e1b75ee858c54c9d672d07fc5967cefc3badc6ddd08a2d`
Author/date: Fifth-pass implementation; 2026-08-09
Affected tables: `Feed`; `Podcast`; `Article`; `PodcastEpisode`
Measured row counts: Not measured in this worktree; obtain current production counts only during an approved release review.
Measured table and index sizes: No index is added. Existing table and index sizes were not measured because this work does not authorize production access.
Expected lock type: PostgreSQL `ALTER TABLE ... ADD COLUMN` takes a brief ACCESS EXCLUSIVE metadata lock for each affected table.
Rewrite or scan risk: The nullable `Article.sourceGeneration` and `PodcastEpisode.sourceGeneration` columns are metadata-only. The `Feed.refreshGeneration` and `Podcast.refreshGeneration` constant `NOT NULL DEFAULT 0` additions are classified for explicit review; PostgreSQL 17 supports fast constant defaults, but production lock wait and server version must be freshly measured before release.
Expected duration: Fast in the completed disposable PostgreSQL 17.10 rehearsal; measure production catalog-lock wait and current source-table sizes only during an approved release review.
Online-safe strategy: Expand ownership and item-generation fields before workers switch to fenced claims. Legacy item generations remain null and are populated only by normal bounded refresh writes; there is no migration-time scan, update, index build, or source backfill.
Backfill plan: No schema-transaction backfill. A current source generation is written when an item is created or normally refreshed. Existing null item generations are safely claimed by the first current refresh, while an older generation can update only a null or lower generation.
Validation plan: Passed Prisma generation, type checking, lease unit tests, item-generation fencing tests including a stalled generation-one worker after generation-two success, and real Redis queue atomic-add tests. A fresh loopback-only PostgreSQL 17.10 container applied all 50 migrations and verified the two non-null generation defaults, six nullable source-lease fields, and two nullable item-generation fields. Before production execution, capture fresh PostgreSQL version, lock-wait, row-count, table-size, index-size, and backup evidence; run the normal approved release gates.
Maintenance mode required: No for the expand migration itself, subject to the owner reviewing fresh production lock and workload evidence before release.
Rollback feasibility: High at the application level because the fields are additive and older application versions ignore them. Do not drop populated generation evidence as an emergency rollback action.
Forward-recovery plan: If an alter lock cannot be acquired, stop and retry only through the approved release procedure after investigating active transactions. If a worker defect is found, deploy a reviewed application correction; do not reset generations or run an unbounded SQL update.
Backup evidence ID requirement: The approved release must capture the exact fresh structured backup evidence ID before any migration execution.
Approver: Not granted for production execution. A later release requires the exact `DEPLOY <short-sha>` approval after the normal gates.
Approval timestamp: Not recorded because production ready is false.
Production ready: false
Production result: Not executed. This record covers checked-in migration SQL and local verification only.

## SQL evidence

- The machine-checked `Migration SQL SHA-256` is calculated from the committed
  UTF-8 migration SQL with line-ending normalization.
- Classifier expectation: two `NON_NULL_ADDITION` findings, one for each
  source generation field. The nullable item columns have no matching
  classifier finding.

# Fifth-pass Phase 9 release package

**Status:** executed and independently verified on 2026-08-10.
**Production release:** `c7be850b644f44629a637fff0a381dee36ad853c`
**Topology:** `all-in-one-with-chat`

> Historical release record: `c7be850` was superseded by the independently
> verified `c04e509` website release later on 2026-08-10. This document
> preserves Phase 9 execution evidence; it is not the current-production
> source of truth.

## Release execution result

The owner approved `DEPLOY c7be850` after exact-commit CI passed. The guarded
release controller ran the local verification stack, built the migrate, web,
worker, chat-gateway, and edge-proxy images off-host, retained the exact
archive and private rollback evidence, ran the fresh backup gate, applied and
verified all 51 migrations, and recreated only the selected application
services.

The first controller attempt stopped at its read-only migration-ownership
preflight. A separately approved repair transferred ownership of only
`DigestRunStatus`, `AiDigestStatus`, and `SmartDigestEmailStatus` to the
configured migration role. The complete ownership preflight then passed before
the successful release was retried.

Independent OVH verification confirmed the deployed commit, migration status,
eight required healthy services, loopback health/liveness, the active-successful
monitor, public health and login HTTP 200, and public internal-health HTTP 403.
The private release record is the authoritative non-secret record of the backup
evidence and retained release artifacts. No authenticated production-user flow
was exercised; CI remains the coverage for those paths.

## Reproducible local evidence

From a clean checkout of the candidate commit, run:

```bash
npm run audit:verify-fifth-pass-ledger
npm run migration:risk -- --base 686cd18b7e7f6196865af34c93496c3bddf16a69
npm run migration:fifth-pass:verify
npm test
npm run redis:boundaries:verify
npm run db:verify-chat-role
npm run test:chat:release-gates
npm run lint
npm run typecheck
npm run release:prepare-fifth-pass -- --commit <full-commit-sha>
```

The last command is read-only.  It rejects a dirty checkout or a SHA other
than `HEAD`, lists the nine fifth-pass migration records, and emits the exact
approval phrase for that commit.  It does not connect to a VPS, deploy,
restart a service, or access production credentials.

The clean-database migration check applies every migration to a fresh,
loopback-published PostgreSQL 17.10 fixture.  It verifies all nine fifth-pass
migration names, records the row estimate plus table/index bytes for the ten
affected tables, and confirms the five new indexes.  Empty fixture measurements
are only a schema rehearsal; they must never be presented as production sizing.

The 2026-08-10 rehearsal applied all 51 migrations.  Each measured table had
zero estimated rows, as expected for a clean fixture.  Its heap/index byte
measurements were:

| Relation | Table bytes | All index bytes |
| --- | ---: | ---: |
| `Article` | 0 | 40,960 |
| `DigestRun` | 0 | 49,152 |
| `ExternalIdentityHashBackfillProgress` | 0 | 8,192 |
| `Feed` | 0 | 40,960 |
| `FeedSubscription` | 0 | 57,344 |
| `ImportJobEntry` | 0 | 32,768 |
| `Podcast` | 0 | 24,576 |
| `PodcastEpisode` | 0 | 24,576 |
| `PodcastSubscription` | 0 | 32,768 |
| `SmartDigest` | 0 | 49,152 |

Each new index occupied 8,192 bytes with zero scans: the OPML-entry lease,
Smart-Digest lease, Smart-Digest `runId`, feed-subscription reverse, and
podcast-subscription reverse indexes.  These are baseline schema measurements,
not a duration, lock, or capacity estimate for production data.

## Deferred acceptance evidence

The release gates above are complete. The following are valuable operational
acceptance exercises, but were intentionally not performed against live user
data during this release:

1. A scheduled restore drill using the retained off-host backup evidence.
2. Live Redis restart-recovery and ACL-denial exercises during an approved
   maintenance window.
3. Authenticated feature acceptance for Source Hygiene, collections, Smart
   Digests, monitoring, and account export using owner-approved test accounts.
4. Production sizing and lock measurements before any future schema-changing
   release.

Use the existing migration risk records for each migration's lock, rollback,
and forward-repair decision.  A failed concurrent index requires an
invalid-index inspection and a reviewed forward repair; never blindly rerun a
partially failed migration.

Every future release still requires a fresh `DEPLOY <short-sha>` approval after
its own exact-commit CI and current readiness checks.

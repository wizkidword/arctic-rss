# Fifth-pass Phase 9 release package

**Status:** prepared only; no production action was performed.  
**Production ready:** false  
**Owner approval:** not granted

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

## Approved-release evidence to collect later

After the candidate's remote CI succeeds, an approved operator must collect
these current production facts before any migration or service change:

1. The exact candidate SHA and successful CI run.
2. A fresh backup evidence ID, an off-host copy identifier, and a successful
   restore-drill evidence ID.
3. Migration-role privileges, PostgreSQL version, current row/table/index
   sizes, invalid-index state, lock wait, and relevant active transactions.
4. Durable and ephemeral Redis ACL proof, including disabled default user and
   denied admin/dangerous commands; then a durable Redis restart recovery test.
5. Restricted chat-role allowed and denied SQL proof.
6. Source Hygiene, collection-after-unsubscribe, monitor, Smart Digest, and
   account-export smoke results against the actual release.
7. Internal and public health/login evidence plus the monitor result after the
   release is complete.

Use the existing migration risk records for each migration's lock, rollback,
and forward-repair decision.  A failed concurrent index requires an
invalid-index inspection and a reviewed forward repair; never blindly rerun a
partially failed migration.

Only after those inputs are reviewed may the owner explicitly type
`DEPLOY <short-sha>`.  That approval remains separate from CI success and from
this package's local evidence.

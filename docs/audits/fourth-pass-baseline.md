# Fourth-pass baseline and reproduction record

**Captured:** 2026-08-08
**Source:** clean isolated worktree on `10896e19aa2a2151edff1bf550f0b3e56fcfe27e` (`origin/main`)
**Production interaction:** none

## Scope and guardrails

The original checkout was 126 commits behind `origin/main` and contained
unrelated guest-OPML work. It was not reset, cleaned, stashed, or edited. This
baseline uses a new worktree at the audited remote commit. No SSH connection,
Cloudflare operation, production container action, production data operation,
or production migration was performed.

## Runtime inventory

| Component | Observed baseline |
| --- | --- |
| Node.js | `v20.19.0` locally; repository declares Node `>=22` and pins Node 24 for its production image |
| npm | `10.8.2` |
| Prisma | `7.8.0` from the locked project dependency |
| Docker Engine | `29.6.2` client and server |
| Docker Compose | `v5.3.1` |
| PostgreSQL image | `postgres:17.10-alpine3.23` |
| Redis image | `redis:7.4.9-alpine3.21` |
| Application images | `arctic-rss-web`, `arctic-rss-worker`, and `arctic-rss-migrate`; not built for this baseline |

The local Node version is below the repository's required range. The commands
below passed on this machine, but that result is not production-parity evidence.

## Locked verification results

| Command | Result |
| --- | --- |
| `npm ci` | Passed; 881 packages installed and Prisma client generated. npm reported 10 audit findings and the expected Node-engine warnings. |
| `npm run prisma:generate` | Passed; Prisma Client `7.8.0` generated. |
| `npx prisma format --check` | Passed. |
| `npx prisma validate` | Passed. |
| `npm test` | Passed: 262 test files passed, 2 skipped; 1,225 tests passed, 3 skipped. |
| `npm run typecheck` | Passed. |
| `npm run lint` | Passed with one existing warning in `src/lib/redis-initial-connection.test.ts` for an unused `key` parameter. |
| `npm run build` | Passed; Next.js 16.2.11 compiled and generated 27 static pages. |
| `npm run topology:validate` | Passed for `all-in-one`, `all-in-one-with-chat`, `split`, and `split-with-chat`. |
| `npm run compose:verify-env` | Passed; Compose service environments exactly match the manifest. |
| `npm run compatibility:verify-legacy-redis` | Passed. |
| `npm run test:chat:release-gates` | Passed: 18 files and 106 tests. |
| `docker compose --env-file .env.example --profile all-in-one config --images` | Passed without reading a production environment file. |

The authenticated Playwright and disposable PostgreSQL topology suites were not
run in this baseline because this isolated worktree has no configured disposable
database fixture. They are required when the affected phases add their explicit
browser, database, or Compose-backed coverage.

## High-priority finding reproduction map

| # | Finding | Baseline result | Evidence |
| --- | --- | --- | --- |
| 1 | Failed source jobs retain a permanent ID | Confirmed | Feed and podcast queues set age/count `removeOnFail`; real local Redis retained the failed job. |
| 2 | Re-enqueue returns old failed source job | Confirmed | The real Redis reproduction returned the same job ID and state `failed` after re-enqueue. |
| 3 | Durable control-plane Redis does not recover | Confirmed by source review | Heartbeat and maintenance clients use `retryStrategy: () => null` and no recovery supervisor. |
| 4 | Web actions perform source refreshes inline | Confirmed by source review | Feed add, directory subscribe fallback, manual refresh, and bulk retry paths import and call `refreshFeed`. |
| 5 | Expensive deletion-handoff work occurs before rate limiting | Confirmed by source review | The route verifies the handoff before `enforceRateLimit`; verification uses synchronous scrypt derivation. |
| 6 | Identical source refreshes update existing rows | Confirmed by source review | `writeRefreshItems` updates every existing external ID and has no content fingerprint. |
| 7 | Ingestion lacks aggregate item/content budgets | Confirmed by source review | Parsers map all RSS/Atom entries; discovery limits fetch count but has no total discovery deadline or item/content aggregate limits. |
| 8 | OPML one-active-job rule is application-only | Confirmed by source review | `findFirst` then transactional `create` has no database uniqueness constraint for pending/processing jobs. |
| 9 | Story current-version filter follows `take` | Confirmed by source review | Story versions are queried with `take` and only then filtered against `currentVersionNumber`. |
| 10 | Collection access is inconsistent after unsubscribe | Confirmed by source review | Collection list filtering exists, but detail and state guards use subscription-only authorization; search begins with a required subscription join. |

## Measured before-change values

### Terminal source-job lifecycle

A disposable local `redis:7.4-alpine` container was created with a random
loopback port, used only for this test, and removed immediately afterward.

```json
{
  "firstJobId": "feed-feed-phase0",
  "retainedAfterTerminalFailure": true,
  "retainedState": "failed",
  "reenqueueReturnedSameId": true,
  "reenqueueState": "failed"
}
```

### Measurements intentionally deferred to the owning phase

No safe reusable seeded PostgreSQL fixture exists in this worktree for SQL
statement counts, WAL bytes, connection budgets, OPML concurrency, or
collection lifecycle measurements. The corresponding phases must add
disposable-fixture tests and record before/after values there. Likewise,
ingestion and deletion timing baselines must be captured with hostile fixtures
before those algorithms change. These gaps are explicit measurement work, not
evidence of a production condition.

## Phase 0 exit status

- The audited source state and topology documentation were reviewed.
- The locked verification stack is recorded.
- All ten high-priority findings are confirmed, including a real Redis
  reproduction for the queue-ID failure.
- No remediation code, migration, or production change is included in this
  baseline record.

The next implementation phase is Phase 1: remove terminal source-refresh jobs
while retaining deterministic active-job deduplication and explicit recent
failure evidence.

## Phase 2 local recovery evidence (2026-08-08)

Phase 2 replaces the two worker clients that permanently stopped reconnecting
with one shared durable-Redis control-plane policy. A failed durable heartbeat
cannot refresh the Docker heartbeat file. A maintenance lease is aborted on
connection loss or failed renewal; after that loss it cannot continue, renew,
or release a potentially newer lease. The client uses a bounded, jittered
reconnect delay. If Redis stays unavailable past the bounded recovery grace,
the worker requests graceful shutdown and exits nonzero.

| Verification | Result |
| --- | --- |
| Focused fake-client tests | Passed: control-plane state/grace/shutdown, lease loss/ownership, later tick, and gated heartbeat behavior. |
| Disposable real Redis restart | Passed: a fresh loopback-only `redis:7.4-alpine` container was restarted during the test; the client observed degradation, recovered, and resumed durable and local heartbeat writes. The container was removed afterward. |
| Type-check and lint | Passed for the Phase 2 implementation. |

This is local source evidence only. It does not claim a production release,
production restart test, or a deployed worker revision.

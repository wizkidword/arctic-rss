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

## Phase 3 local queue-placement evidence (2026-08-08)

Manual refresh, bulk source-attention retry, and incomplete initial-import
fallbacks now authorize and submit a deterministic BullMQ job. The request
returns `queued` or `already-queued` without waiting for a remote source. Job
data contains only the source ID and one low-sensitivity trigger label. OPML
does not add a duplicate job after its initial XML import succeeds.

| Verification | Result |
| --- | --- |
| Action and architecture tests | Passed: manual and bulk queue outcomes, paused/cooldown guards, no direct feed-refresh action import/call, and initial-import queue behavior. |
| Real Redis queue lifecycle | Passed: terminal-job removal, later re-enqueue, and concurrent active-job deduplication for feeds and podcasts. |
| Browser coverage | Not run: this isolated worktree has no configured disposable authenticated browser/database fixture. This remains required before a release claim. |

No migration, production action, push, or deployment is included in this phase.

## Phase 6 local changed-only persistence evidence (2026-08-08)

Feed articles and podcast episodes now use a versioned SHA-256 fingerprint of
their normalized mutable source fields. A new item is inserted. An existing
item with the same fingerprint is not updated. A changed item, or an older row
with a null fingerprint, receives one normal update that saves the current
fingerprint. Optional source fields are explicitly cleared to `null` when a
correction removes them, so stored data cannot disagree with its fingerprint.

The migration is an expand-only nullable column addition with no default,
backfill, index, generated field, or stored procedure. Its checked-in risk
record includes the exact SQL SHA-256 and a production lock/recovery decision.
The `ingestion:persistence:measure` script refuses every non-loopback database
and requires an explicit disposable-database flag; it creates then removes its
own feed and podcast fixtures while measuring initial inserts, identical
no-op writes, corrected writes, and the PostgreSQL WAL delta.

| Disposable PostgreSQL verification | Result |
| --- | --- |
| Schema migration | All 39 checked-in migrations, including the fingerprint expansion, applied successfully to a temporary loopback `postgres:17.10-alpine3.23` container. The container was removed after the check. |
| First refresh equivalent | Two rows inserted (one article and one episode); 2,192 WAL bytes. |
| Identical refresh equivalent | Zero inserted, zero changed, two unchanged; zero WAL bytes. |
| Corrected refresh equivalent | Two rows changed (one article and one episode); 336 WAL bytes. |

No migration, production action, push, or deployment is included in this phase.

## Phase 4 local account-deletion handoff evidence (2026-08-08)

The final cross-device deletion confirmation now authenticates and rate-limits
the user/IP before reading its bounded JSON body or examining the handoff
cookie. New `v2` cookies use an HMAC-SHA-256 signing key derived once from the
configured `AUTH_SECRET` by HKDF-SHA-256. Existing `v1` cookies remain valid
only for their original 15-minute lifetime and are verified asynchronously,
after the limiter; new `v1` cookies are never issued. Cookie, payload, and
signature forms are strictly bounded and canonical before comparison.

This is local source and test evidence only. It does not claim a production
release, real-account deletion, push, or deployment.

## Phase 5 local ingestion-budget evidence (2026-08-08)

Feed and podcast parsing now uses one reviewed limits module. The system retains
source order, accepts at most 1,000 source items, rejects an oversized external
ID rather than truncating it, limits optional fields and stored body content,
and records count-only parse metrics. Feed discovery uses at most six attempts
and one 30-second parent deadline, which cancels each child fetch without
leaking host/global limiter capacity. XML entity processing is disabled;
standard XML escapes are decoded deliberately while publisher-defined entities
remain literal and inert. Feed text recognizes only a small charset allowlist.

| Verification | Result |
| --- | --- |
| Hostile and ordinary parser fixtures | Passed: a two-megabyte thousand-item feed, oversized fields and IDs, entity/DOCTYPE cases, normal RSS/Atom/podcast, and OPML parsing. |
| Fetch/discovery bounds | Passed: parent cancellation releases the limiter slot, six-attempt cap, shared discovery deadline, redirect budget, and Windows-1252 / ISO-8859-1 decoding. |
| Static checks | Passed: TypeScript, Compose service-environment boundary, and all four topology configurations. |

No migration, production action, push, or deployment is included in this phase.

## Phase 7A local exact-environment evidence (2026-08-08)

The service-role manifest now also records runtime-only compatibility aliases
and every known managed deployment input. At production startup, the web,
every worker role, and the chat gateway derive their allowlist from that one
registry. A known variable outside the active role fails before application
startup and names only the variable and role. Ordinary process values such as
`PATH`, `HOME`, and the Node runtime version are deliberately outside that
registry.

Focused tests cover every manifest role and a production-startup failure for
each application role when an infrastructure secret is injected. Compose
environment verification and doctor required-variable reporting continue to
read the same manifest. No credentials were changed, rotated, printed, or
deployed.

## Phase 7B local Compose dependency evidence (2026-08-08)

The shared worker template no longer imposes an ephemeral Redis dependency.
The four durable-only worker roles now wait for only migration completion and
durable Redis health. The all-in-one worker and chat-event worker still wait
for both Redis services; the chat gateway waits for migration completion and
ephemeral Redis only. The rendered-Compose dependency check asserts the exact
dependency names and readiness conditions for every affected service.

No production worker was restarted, no Redis credential changed, and no
deployment occurred.

## Phase 7C local Redis credential and network evidence (2026-08-08)

Durable and ephemeral Redis now each receive only a dedicated ACL username and
password. Redis starts with the default ACL user disabled; workload URLs in a
normal production environment must include distinct usernames and passwords as
well as distinct endpoints. The temporary legacy URL remains a direct-process,
owner-gated pre-ACL recovery path only and is never injected into Compose
application services.

Compose declares exactly three reviewed networks. Durable-only workers attach
only to `durable-data`. The chat gateway attaches to
`ephemeral-realtime` and `web-edge`, not `durable-data`; PostgreSQL also joins
`web-edge` temporarily because the gateway continues to use the existing
runtime database role until Phase 7D. Web and the chat-event worker retain the
two Redis networks they currently require. All infrastructure host ports remain
loopback-only.

| Verification | Result |
| --- | --- |
| Rendered Compose network boundary | Passed: every affected service has the exact reviewed network set. |
| Disposable ACL Redis integration | Passed: durable credentials fail on ephemeral Redis, ephemeral credentials fail on durable Redis, the chat-gateway-shaped network cannot resolve durable Redis, and the ingestion-worker-shaped network cannot resolve ephemeral Redis. |
| Configuration guard | Passed locally: direct production workload URLs require a username/password and reject shared ACL usernames or passwords. |

No production Redis credential was read, created, rotated, or printed. No
production container, OVH host, push, or deployment was changed.

## Phase 7D local chat database-role evidence (2026-08-08)

The chat gateway now takes `CHAT_DATABASE_URL` rather than the normal runtime
database URL. Its idempotent PostgreSQL bootstrap creates a non-superuser,
non-schema-owning login with only the column and table privileges used by
gateway authorization, room snapshots, normal-message creation, read markers,
and event-outbox writes. Display-only article shares expose only ID, feed ID,
and title; publisher lookup exposes only ID and title. The gateway does not
receive access to article bodies, account passwords or deletion/reset hashes,
AI records, plan/role changes, chat reports, or schema DDL.

`npm run db:verify-chat-role` creates a disposable PostgreSQL instance,
applies committed migrations, applies the bootstrap twice, performs the real
gateway authorization and room/message/read-marker paths, and proves each
restricted SQL operation is rejected. The role bootstrap is outside Prisma
migrations, and the migration service remains the only schema-owning
application path.

No production database role or password was created, changed, read, or
printed. No production container, OVH host, push, migration, or deployment was
changed.

## Phase 8A local story-signal evidence (2026-08-08)

Related-coverage evaluation now reads an authorized `StorySignalArticle`
projection containing only article ID, title, URL, canonical URL, and
publication time. The selected-article check and the capped candidate window
retain the existing subscription and archive constraints, but no longer load
article HTML/text, AI summaries, collection lists, reader-state fields, or
sanitizer inputs.

Canonical values are retained only from explicit, safely normalized feed or
Atom canonical links, or from an already-approved linked-page enrichment:
HTML `rel=canonical`, then `og:url`, then the safe final HTTP URL. No new page
fetch is performed to obtain canonical metadata. Query-shape, canonical
normalization/equality, unsafe-canonical, misleading-domain, and no-body-read
tests cover the boundary.

No production data, source fetch, credential, migration, container, OVH host,
push, or deployment was changed.

## Phase 8B local current-story-version evidence (2026-08-08)

Related-coverage presentation now queries active user-owned `StoryCluster`
records as the root, then selects only each cluster's highest version under the
existing invariant that the current version is highest. The bounded `take`
therefore applies to clusters rather than historical version rows. A cluster
with thirteen older versions cannot crowd an older active cluster out merely
because its history is longer.

Member display still rehydrates through the existing subscription and archive
authorization guard. If a source is paused, unsubscribed, or archived, the
whole saved group is withheld rather than showing an incomplete grouping. AI
comparison copy now states its original source count at generation separately
from the number of sources currently visible in the group.

No production data, credential, migration, container, OVH host, push, or
deployment was changed.

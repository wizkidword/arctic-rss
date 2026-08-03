# Phase 9 — Search measurement and query-plan evidence

## Status

Implemented locally. The change is source- and database-migration ready but
has not been deployed.

## Baseline

- Starting Git SHA: `dc0dbb55b7035a1924629c092648e9c0d1f931c5`.
- Relevant files: `src/lib/article-search.ts`, the article full-text migration,
  article-search tests, and the disposable benchmark runner.
- Confirmed finding: the original query reconstructed the same weighted
  `tsvector` in both its match predicate and `ts_rank_cd` calculation. The
  existing expression GIN index only helped isolated selective predicates; the
  complete reader query could still re-evaluate the vector across its joined
  candidate set.

## Changes implemented

- Added the PostgreSQL-generated `Article.searchDocument` weighted `tsvector`
  and a GIN index with the existing `Article_searchDocument_idx` name.
- The migration creates the stored index before swapping out the expression
  index, so there is always an indexed full-text path during staging.
- Reader search now uses the stored document for matching and standard weighted
  `ts_rank` for ranking. This retains the A/B/C/D title/author/summary/body
  weights while avoiding cover-density work that was materially expensive for
  broad multi-term queries.
- Added a 250 ms slow-search event. It records only duration, filter presence,
  normalized state, result outcome, and query length; it never logs a user ID,
  search text, source, folder, or collection identifier.
- Added `npm run search:measure`, which requires
  `ARCTIC_RSS_SEARCH_BENCHMARK_CONFIRM=disposable`, rejects production mode,
  and accepts only loopback PostgreSQL. It creates and removes its synthetic
  fixture automatically.

## Security impact

- The user-scoped, parameterized query and its second authorization projection
  guard remain unchanged.
- The benchmark cannot target production or a non-loopback database without
  changing reviewed source, and uses no production data or credentials.
- Slow-query telemetry is deliberately non-identifying and does not emit a
  search phrase.

## Operational impact

- The generated column is maintained by PostgreSQL whenever indexed article
  text changes. This replaces repeated read-time vector construction with a
  bounded write-time storage cost.
- The old expression index is swapped only after the stored GIN index exists.
- The benchmark target is **p95 <= 350 ms** per scenario on its documented
  30,000-article disposable corpus.

## Database/migration impact

- `20260803010000_add_stored_article_search_document`
  - adds `Article.searchDocument` as a generated weighted `tsvector`;
  - builds a replacement GIN index;
  - swaps the old expression index after the replacement exists.

## Tests and commands run

- `prisma format` — passed.
- `prisma validate` — passed.
- Focused Vitest coverage for query binding, telemetry, benchmark guardrails,
  and migration SQL — 9 tests passed.
- `npm run typecheck` — passed.
- Existing PostgreSQL article-search integration coverage on a disposable,
  fully migrated database — 2 tests passed.
- `npm run search:measure` with a disposable loopback PostgreSQL database —
  final target passed after the stored-vector and weighted-rank change.

## Evidence

The benchmark used 24 subscribed sources, 6 folders, 30,000 articles with
900-byte synthetic bodies, and 15,000 reader-state rows. Each latency is the
p95 of 15 warmed samples. No fixture identifiers or URLs were retained.

| Scenario | Original expression + cover-density rank | Stored vector + cover-density rank | Final stored vector + weighted rank |
| --- | ---: | ---: | ---: |
| Common term | 2451.96 ms | 141.34 ms | 58.30 ms |
| Rare term | 3585.78 ms | 126.53 ms | 115.70 ms |
| Multi-term | 2665.26 ms | 2421.24 ms | 62.91 ms |
| Feed-name match | 3792.22 ms | 259.12 ms | 134.46 ms |
| Folder-name match | 4420.46 ms | 604.95 ms | 171.50 ms |
| Unread filter | 1673.88 ms | 122.65 ms | 104.62 ms |
| High-volume starred match | 384.35 ms | 56.75 ms | 21.22 ms |

`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` on the final run showed:

- the selective rare-term predicate used `Article_searchDocument_idx` through
  a bitmap index/heap scan (0.49 ms, 107 shared-hit blocks);
- the deliberately broad high-volume term used a sequential scan (11.16 ms,
  7,500 shared-hit blocks), which is the correct planner choice when nearly
  every article matches;
- feed and folder label plans scanned their tiny 24-row and 6-row tables
  respectively, so the existing trigram indexes were not forced without a
  measured benefit.

## Remaining risks

- The target is representative disposable evidence, not a claim about live
  production hardware or data distribution. Observe the non-identifying slow
  event after release before considering additional indexes.
- Standard `ts_rank` intentionally favors weighted term frequency rather than
  cover-density proximity. The search result remains user-scoped and ordered by
  the same title/author/summary/body weights, but relevance should be observed
  during normal post-release smoke testing.

## Rollback

- The migration is forward-only. The prior code remains functionally compatible
  with the generated column, but would no longer have its expression GIN index.
  A permanent code rollback therefore needs a reviewed follow-up migration to
  restore that index; do not attempt a production schema rollback ad hoc.
- The approved release record retains the prior image/source release for the
  normal code rollback path.

## Next phase gate

Pass after the full local verification and CI for this commit. Production
promotion remains subject to a fresh typed deployment authorization.

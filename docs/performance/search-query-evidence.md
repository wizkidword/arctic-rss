# Search query-plan and telemetry evidence

## Status and scope

The source now emits one privacy-safe, low-cardinality `article_search_metrics`
event for every executed full-text search. It includes the requested request,
duration, result-count, filter-count, and timeout counters. The event contains
no search phrase, user ID, feed ID, folder ID, collection ID, URL, or database
error text.

This document distinguishes source and synthetic evidence from production
evidence. Nothing here asserts an observed production query plan, latency, or
release state.

## Runtime telemetry

| Field | Meaning | Cardinality/privacy boundary |
| --- | --- | --- |
| `event` | Fixed value: `article_search_metrics`. | One event name. |
| `outcome` | `completed` or `failed`. | Two values. |
| `search_requests_total` | Always `1` per executed search. | Counter-friendly integer. |
| `search_duration_ms` | Rounded database-query duration. | Integer; no query data. |
| `search_results_count` | Number of hydrated visible results. | Integer; no result IDs. |
| `search_filter_count` | Count of source, folder, collection, date, and state filters. | Integer, never filter values. |
| `search_timeout_total` | `1` only for PostgreSQL cancellation (`57014`) or a timeout-shaped error. | Boolean-like integer; no raw error. |

The existing `article_search_slow_query` warning remains a thresholded
diagnostic. It is complementary, not the sole metric path.

## Query behavior

Search uses the stored weighted `Article.searchDocument` `tsvector` and its
GIN index. The query remains parameterized and scoped to the signed-in user's
active subscriptions; the result IDs are re-projected through the existing
reader authorization helper before display.

The reader treats a blank text query as an empty search and returns without a
database full-text query. Therefore a "filter-only search" has no search plan
in this route by design; it does not silently become an unbounded article-list
query. Filter-only browsing must use a separately reviewed reader-list path.

## Synthetic benchmark methodology

`npm run search:measure` creates a synthetic, loopback-only fixture and
rejects production mode. It requires
`ARCTIC_RSS_SEARCH_BENCHMARK_CONFIRM=disposable`, accepts only PostgreSQL on a
loopback host, and removes the fixture after the run. Its scenarios cover text
only, unread, starred large-result, feed-name, folder-name, and multi-term
searches. The application's date filters use the same prepared query shape;
capture a fresh date-range plan before adding a date index.

The retained prior synthetic run used 24 subscribed sources, 6 folders,
30,000 articles with 900-byte synthetic bodies, and 15,000 reader-state rows.
Each result was a p95 of 15 warmed samples. It is historical synthetic evidence
only, not a current-branch rerun or a production benchmark.

| Scenario | Prior final p95 | Prior plan observation |
| --- | ---: | --- |
| Text only, common term | 58.30 ms | Stored vector with weighted rank. |
| Text only, rare term | 115.70 ms | Bitmap index/heap scan via `Article_searchDocument_idx`; 0.49 ms plan execution. |
| Text plus unread | 104.62 ms | State-filtered reader query. |
| Text plus starred, large result set | 21.22 ms | Sequential scan was correctly cheaper for a broadly matching term; 11.16 ms plan execution. |
| Feed-name text match | 134.46 ms | Tiny feed table scanned without forcing a trigram index. |
| Folder-name text match | 171.50 ms | Tiny folder table scanned without forcing a trigram index. |
| Text plus date range | Not captured in the retained run | Fresh disposable plan required before adding an index. |
| Filter-only input | Not applicable | The route exits before database search. |

The full retained before/after table and raw plan summary are in
[the prior search performance audit](../audits/second-pass-phase-9-search-performance.md).

## Initial third-pass Compose attempt

On 2026-08-08, an isolated Compose project was created on an alternate
loopback PostgreSQL port to rerun the synthetic benchmark. Docker could create
the project resources but could not start PostgreSQL because the Compose stack
requires the `journald` logging driver and that driver is unavailable on this
Windows Docker host. The isolated container, network, and volume were removed
after the failed start. No migration, benchmark, query plan, or production
resource was touched.

## Third-pass disposable result

After that Compose-only logging limitation, the benchmark was rerun on
2026-08-08 against a direct disposable PostgreSQL 17.10 container on a unique
loopback port using Docker's `local` logging driver. The database used a fresh
throwaway credential, received all 38 committed migrations, and was removed
immediately after the run. No Compose service, production resource, production
account, or production data was used.

The current branch passed the 350 ms p95 target in every recorded scenario:

| Scenario | p95 (15 warmed samples) | Sanitized plan observation |
| --- | ---: | --- |
| Text only, common term | 59.59 ms | Broad match; no forced index claim. |
| Text only, rare term | 103.39 ms | `Article_searchDocument_idx` through Bitmap Index/Heap Scan; 0.50 ms plan execution. |
| Multi-term text | 60.79 ms | Within target. |
| Feed-name text match | 120.13 ms | Tiny feed table sequential scan. |
| Folder-name text match | 158.39 ms | Tiny folder table sequential scan. |
| Text plus unread | 91.21 ms | Within target. |
| Text plus starred, large result set | 24.46 ms | Broad match sequential scan; 10.69 ms plan execution. |

This is a fresh, synthetic current-branch result, not production latency or a
production query-plan claim. The benchmark does not include a date-range
scenario, so capture a dedicated disposable date-range plan before considering
a date-specific index. Do not add another index until that plan justifies it.

## Future measurement procedure

On a compatible disposable host, create a fresh local PostgreSQL database,
apply the committed migrations with the migration credential boundary, then
run:

```bash
ARCTIC_RSS_SEARCH_BENCHMARK_CONFIRM=disposable npm run search:measure
```

Record only synthetic corpus dimensions, rounded timings, and sanitized plan
observations. Do not include connection strings, fixture IDs, article text, or
operator data. A production release remains separately owner-gated and must
observe the privacy-safe metrics after public and authenticated smoke checks.

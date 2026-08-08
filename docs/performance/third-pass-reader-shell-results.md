# Third-pass reader and shell performance results

**Recorded:** 2026-08-08
**Baseline:** `e227dad36a73b045b34dd9e4ad34c6fcc6e5aaf7`
**Scope:** Phase 1 reader-related data, navigation, layout queries, and transcript work

## Method and boundaries

All measurements were collected locally against the production build using the
repository's bundled Node 24 runtime. A disposable loopback-only PostgreSQL and
Redis stack was created for this measurement, 38 migrations were applied, and a
synthetic authenticated reader was populated with 10, 100, and 200 synthetic
feed subscriptions. No production service, production account, production
database, secret value, tunnel, DNS record, or deployment was used.

For each feed count, a fresh real-browser session logged in at the local app.
The measurements below are the browser's observed resource transfer and DOM
sizes after the authenticated `/app` transition. The RSC value is the larger of
the two `/app?_rsc=` responses seen during the transition (navigation and
prefetch). It is a useful payload indicator, not a direct hydration timer.
Browser `usedJSHeapSize` is included only as a spot measurement; garbage
collection makes it unsuitable as a precise before/after memory comparison.

The repository-wide local gates completed successfully:

| Gate | Result |
| --- | --- |
| `tsc --noEmit` | Passed |
| Focused Phase 1 tests | Passed: 8 files, 79 tests |
| `npm run lint` | Exit code 0; three pre-existing warnings in untouched files |
| `npm test` | Passed: 248 files, 1,162 tests; 2 files and 3 tests intentionally skipped |
| `npm run build` | Passed: optimized Next.js production build |
| Disposable production-build browser suite | Passed: 8 of 8 authenticated and public journeys |

## Related-story hydration (P1-01)

The old reader-detail loader and new related-story loader were run against the
same synthetic articles. Each article had deliberately large HTML and text
bodies, so the results make the avoided data transfer visible. The JSON byte
count is the serializable loader result, not a PostgreSQL wire-protocol trace.
Times are single local warm-cache samples and are recorded for context only.

| Related articles | Before: detail result | After: metadata result | Data avoided | Before time | After time |
| --- | ---: | ---: | ---: | ---: | ---: |
| 0 | 2 B | 2 B | 0 B | 0.08 ms | 0.04 ms |
| 5 | 146,309 B | 1,024 B | 145,285 B (99.3%) | 30.74 ms | 8.21 ms |
| 20 | 585,223 B | 4,083 B | 581,140 B (99.3%) | 10.74 ms | 4.36 ms |

The new loader selects only `id`, `title`, `url`, `publishedAt`, and
`feed.title`. It retains the existing subscription and archive authorization
predicate and caller order. Article body, AI, collection, and reader-state
hydration is no longer requested, and the related-story path no longer runs
HTML sanitization because it has no HTML input. Focused tests cover zero, one,
many, duplicate, and inaccessible related articles.

## Navigation (P1-02)

Before this change, desktop and always-mounted mobile reader trees each owned a
feed context menu for every subscription. The new shell has one shared menu
controller. The mobile reader navigation is dynamically loaded and is mounted
only after its sheet is opened.

| Feed fixture | Before: persistent menu owners | After: persistent menu owners | Reduction |
| --- | ---: | ---: | ---: |
| 10 feeds | 20 | 1 | 95% |
| 100 feeds | 200 | 1 | 99.5% |
| 200 feeds | 400 | 1 | 99.75% |

| Feed fixture | Browser-confirmed feed links | Client JS transferred | Authenticated shell DOM | Largest RSC response | Largest RSC duration | JS heap spot check |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 10 feeds | 10 | 290,652 B | 119,582 B | 26,621 B | 132 ms | 8,408,489 B |
| 100 feeds | 100 | 290,652 B | 246,843 B | 49,455 B | 179 ms | 9,134,983 B |
| 200 feeds | 200 | 290,652 B | 388,243 B | 75,457 B | 177 ms | 9,777,098 B |

The client-JavaScript transfer stayed flat across the three synthetic feed
counts. The server-rendered shell and RSC payload scale with the number of
feed links, as expected; this change removes the per-feed client menu state but
does not virtualize the visible feed list.

The real browser also verified the interaction path: desktop right-click opens
the full action menu, and Escape dismisses it. At a 390 × 844 viewport, the
mobile navigation was absent before opening the sheet, then showed all 10
feeds after opening; its feed right-click used the same action menu. This
confirms the lazy mobile boundary and shared controller work in the rendered
app, not only in component tests.

## Authenticated-layout queries (P2-06)

The layout retains its existing independent `Promise.all` loading pattern. It
does not have a per-feed unread-count loop: subscriptions and folders each use
one grouped unread-count query for the requested feed IDs.

| Loader | Before | After |
| --- | --- | --- |
| Feed subscriptions | Broad `feed: true` and `folder: true` relations | Explicit navigation fields and `folder.name` only |
| Folders | Full folder scalar record plus selected subscriptions | `id`, `name`, and selected subscription `feedId` only |
| Collections and active bulk-read job | Explicit projections already present | Unchanged |
| Reader counters | Three scoped count queries | Unchanged; no cache added without an observed cost issue |

The existing 200-feed subscription and grouped folder-count tests pass after
the selection changes. Statement-level query timing was intentionally not
claimed because this run did not add database tracing instrumentation.

## Transcript single-flight (P3-07)

Ten simultaneous authorized cache misses for the same normalized transcript URL
now produce exactly one outbound fetch in the focused test. The in-flight entry
is cleared after both success and failure; tests also cover retry after a
failure and concurrent requests to different URLs. Existing cache, SSRF and
redirect checks, byte limits, parser limits, and host/global concurrency limits
remain in the request path.

## Interpretation

Phase 1 has direct local browser and loader evidence for its reader-shell
changes. The related-story path now returns roughly 99.3% less serializable
data for the deliberately body-heavy 5- and 20-article fixtures, while the
navigation work reduces persistent per-feed menu ownership to one controller
and keeps initial client JavaScript flat through 200 feeds.

There is no historical browser A/B timing claim for the unmodified audit
baseline: it was not run as a separate production-build browser fixture. The
"before" values above are therefore exact structural counts and an in-process
old-loader comparison, while browser transfer and DOM measurements describe the
implemented result only. This is sufficient to validate the phase locally, but
is not authorization for a production release or deployment.

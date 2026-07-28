# Arctic Story Search: query-plan acceptance record

Status: source implementation is ready for CI verification; this document does
not claim a production performance result.

## Scope

The first Story Intelligence slice searches only articles readable through an
active subscription owned by the current user. It excludes the current user's
archived articles and rechecks the same rule while loading display data. It
does not add semantic embeddings, saved monitors, external sharing, or access
to another user's source, folder, collection, or state.

The query has two indexed discovery paths:

- A weighted PostgreSQL full-text expression over article title, author,
  summary, and readable body text. The GIN expression index uses the `simple`
  text configuration so the behavior is deterministic for mixed-language feed
  content.
- Trigram GIN indexes for feed titles, user-specific source aliases, and
  user-owned folder names. The search term is parameterized as one `%term%`
  pattern and escapes LIKE wildcards using PostgreSQL's default backslash
  escape character before these paths are used.

The feed subscription and article-state joins remain the authorization
boundary. A result id is then hydrated through the normal Reader visibility
guard to prevent a subscription change between discovery and rendering from
leaking an article.

## Required evidence before a production release

Run this only against an isolated PostgreSQL 17 verification database with a
representative, non-user-data fixture. Do not run a broad `EXPLAIN ANALYZE`
against production without first reviewing current OVH headroom and the exact
query parameters.

1. Apply all migrations, including `20260728120000_add_article_full_text_search`.
2. Confirm the migration role can install the trusted `pg_trgm` extension in
   the target database before the release window.
3. Seed representative active and paused subscriptions, archived and unread
   states, folder names, source aliases, and a mixture of short and long
   article bodies.
4. Capture `EXPLAIN (ANALYZE, BUFFERS)` for an article-body phrase and a
   source/folder phrase using the same tenant scope and filters as the app.
5. Record the plan, row counts, elapsed time, and index sizes in the release
   evidence. The plans should use the article GIN expression index for a body
   phrase and a trigram GIN path when a source or folder phrase is selective.

If the chosen plan regresses to a broad sequential scan at expected data
volume, pause the release. Rework the search branches or indexing strategy
before seeking a typed deployment approval.

## CI evidence

The PostgreSQL integration suite creates a non-user-data corpus with 1,000
article bodies and 5,000 selective source/folder labels on the same PostgreSQL
17 image used by production and captures
`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` for each indexed discovery
expression. It requires the article full-text GIN plan and records the
trigram-plan tree in CI output. PostgreSQL can correctly prefer a sequential
scan for the small fixed label corpus, so CI does not pretend that a
trigram-index choice there proves live-scale behavior. The committed migration,
extension, and index expressions are nonetheless exercised together on a clean
database. CI is intentionally not a substitute for the production preflight
above: it cannot establish OVH resource headroom, production statistics, the
migration-role privilege, or the complete tenant-scoped query plan at live
scale.

## Migration note

The search document is an indexed expression rather than a stored generated
column. This avoids rewriting the shared `Article` table while preserving the
same weighted `tsvector` lookup. Index creation is still a capacity-sensitive
operation and remains subject to the normal OVH release preflight.

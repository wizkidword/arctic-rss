# Phase 6A — Reader list/detail projections

## Status

Implemented locally; release verification is pending the remaining Phase 6
authenticated-shell work.

## Baseline

The standard reader, filtered reader, search, and guest-preview list paths
used one full `Article` relation shape. A typical 50-item page therefore
retrieved article HTML and text, loaded the latest AI detail, and sanitized
every HTML body before the user selected an item.

## Changes implemented

- Added explicit `ReaderArticleListItem` and `ReaderArticle` detail shapes.
- Converted default reader, search-result, and guest-preview queries to a
  narrow Prisma `select` containing navigation/card data and current read/star
  state only.
- Loaded and sanitized a full article only for the selected list item, through
  the existing subscription and archive authorization guard.
- Kept full-record loading available for internal story-cluster work, where
  article content is required to compare stories.
- Made River mode an explicit bounded exception: it fetches details for the
  first 10 rows, plus a valid explicitly selected item when different.
- Updated authenticated reader, filter, collection, search, guest, and stable
  article routes to pass list rows and selected detail separately.

## Security impact

The list-to-detail transition does not trust a URL parameter alone. The selected
id must first be visible in the list result, then is hydrated through the same
active-subscription and non-archived-state authorization boundary. Guest detail
is separately constrained to the Discover feed allowlist.

## Performance evidence

`src/lib/articles.test.ts` constructs 50 representative rich article bodies and
asserts that the serialized list result is less than 5% of the equivalent
full-record payload. The same test asserts that default list and search
projections omit `contentHtml`, `contentText`, AI summaries, and author detail.
`src/lib/reader-articles.test.ts` asserts the River cap.

This is a deterministic structural/payload measurement. Production database
bytes, render time, sanitizer time, and memory remain to be captured with a
representative disposable database before Phase 6 is marked complete.

## Verification

- `npm run typecheck`
- Focused Vitest coverage for reader projections, reader authorization,
  full-text hydration, page contracts, guest preview, and reader rendering

## Remaining Phase 6 work

- Capture database and render measurements on representative seeded data.
- Move structural authenticated-shell rendering to server components with
  narrowly scoped client islands.
- Measure bundle and hydration changes before and after that shell split.

# Seventh-pass Phase 9: mobile offline sync

**Status:** source implementation verified with focused SQLite tests; no signed-device run.

## Transactional invalidation

`MobileOfflineStore.commitSyncPage` now validates each typed sync event and, in
the same exclusive SQLite transaction, deletes only cache keys affected by the
event before committing the new cursor. Article state invalidates its detail,
reader, search, and saved-view data; collection, saved view, subscription,
briefing, podcast, and notification events have their own conservative key
mapping. A future unrecognized event type falls back to a full derived-cache
clear rather than advancing a cursor over stale data. Pending mutations are
not touched by this path or by bootstrap recovery.

Focused tests prove an article event evicts its affected reader/detail cache
while retaining collections and notification settings, and a notification
event leaves reader data intact.

## Selected offline data

- Reader pages, starred pages, and recently opened article details continue to
  use the owner-scoped device cache.
- A user can select up to ten collections from its reader screen. Selection
  retains the collection's downloaded reader pages within the existing 20 MB,
  300-entry, 30-day, and 2 MB-per-entry cache limits.
- No predictive background prefetch was added: metered connections therefore
  do not acquire selected-collection content without a user opening the
  collection or requesting a normal sync. The Settings screen reports cached
  entry/byte counts and selection count, offers manual sync, and clears the
  cache, cursor, and selections together.
- Data is scoped to the authenticated user and stable device and is removed
  during local logout or an account/device ownership change.

## P3 cache maintenance

Mobile schema version 3 adds indexes for expiration and least-recently-used
eviction. Cache writes delete expired rows with the `updatedAt` index, obtain a
single aggregate, and then select and remove only the oldest rows needed by
the `accessedAt, cacheKey` index. They no longer load every cache entry for
each write.

## Verification

`npx vitest run apps/mobile/src/storage/mobile-store-schema.test.ts apps/mobile/src/storage/mobile-offline-store.test.ts` passed: 2 files, 8 tests.

`npm run mobile:typecheck` and targeted ESLint passed.

## Not production evidence

No physical device, metered-network test, production API, or deployed service
was accessed. The superseded Android candidate cannot establish this phase on
a signed device.

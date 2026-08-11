# Sixth-pass Phase 4 local schema repair

**Status:** source-verified; the Android device matrix remains open.

`arctic-rss-mobile.db` now uses SQLite `user_version` 1. Initialization is
shared through one promise, so schema setup runs once per app process. A
version-0 database is reset transactionally before the version-1 tables are
created. This is an intentional one-time destructive reset of the previous
unsigned alpha's local cache, queue, cursor, milestones, and owner metadata;
it never touches server data.

Versions newer than the app supports fail closed. Cache writes plus eviction,
owner changes, queue admission, and local clearing/purging use exclusive
SQLite transactions. A malformed cached JSON row is deleted on read. Malformed
pending-mutation rows are deleted before queue capacity is calculated, so they
cannot block a later valid offline change.

The remaining evidence is device-level: upgrade from the previous alpha,
corrupt SQLite row recovery, logout/account-switch behavior, and restore with
no credentials. No signed artifact, Android restore test, or Play action has
occurred.

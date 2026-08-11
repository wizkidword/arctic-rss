# ADR 0004: transactional mobile sync invalidation journal

**Status:** accepted for sixth-pass source work.

## Decision

The mobile client keeps bounded API-response caches, not a second copy of the
server database. Typed journal changes transactionally invalidate affected
cache keys and advance the sync cursor in the same SQLite transaction. Unknown
event versions are not acknowledged.

A full resync preserves pending mutations, removes only derived/downloaded
cache, retrieves an authoritative bootstrap/high-water cursor, then commits
minimal replacement metadata and that cursor atomically. It never discards an
event page merely to advance a cursor.

## Rationale and consequences

The server remains authoritative for reader state and complex domain rules.
The journal is sufficient for correct freshness while keeping local storage and
conflict surfaces bounded. This decision requires convergence and crash-point
tests before the finding can become source-verified.

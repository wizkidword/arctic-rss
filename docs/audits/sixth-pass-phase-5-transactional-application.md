# Sixth-pass Phase 5 transactional mobile event application

**Status:** source-verified; native SQLite and convergence-device evidence
remain open.

Each sync page is revalidated against the versioned event union before the
mobile store opens an exclusive transaction. For any non-empty page it clears
the bounded derived cache, then writes the page cursor and (on the final page)
the local product milestone in that same transaction. The pending mutation
table is deliberately untouched.

The client follows `hasMore` pages until the terminal page. A missing or
repeated next cursor fails before the page can be committed. `409
FULL_RESYNC_REQUIRED` invokes the separate high-water bootstrap endpoint. It
preserves pending mutations, transactionally clears only derived cache and
commits the fresh high-water cursor, then resumes incremental sync. The
previous request-header product milestone was removed because the server could
record it before the client had committed the event page.

The invalidation is deliberately coarse—all derived cache rather than an
incomplete projection—while the event set is still small. Native SQLite
failure injection, retention maintenance, and multi-device convergence tests
remain required before source completion.

# Sixth-pass Phase 5 cursor safety

**Status:** superseded by transactional page application; retained as the
initial fail-closed rationale.

The existing mobile client had no event-application path, yet it committed the
server-provided cursor and first-sync milestone after every response. A
non-empty event page could therefore be acknowledged and never processed.

That initial guard left both cursor and milestone unchanged whenever a response
contained events. It has now been replaced by the Phase 5 transactional page
commit: valid typed events coarsely invalidate derived cache and commit the
next cursor in one SQLite transaction. A retention-floor response remains
fail-closed until the separate bootstrap work is complete. This document does
not make any runtime or deployment claim.

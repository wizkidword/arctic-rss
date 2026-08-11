# Sixth-pass Phase 5 high-water bootstrap

**Status:** source-verified endpoint and mobile path; PostgreSQL rehearsal and
native SQLite crash-point proof remain open.

`GET /api/v1/sync/bootstrap` requires a current device session and returns only
the requesting user's latest retained journal sequence, or `null` when none
exists. The response contains no account profile, article body, search query,
token, feed list, or pending mutation data.

After `FULL_RESYNC_REQUIRED`, the mobile client calls this endpoint, then uses
one exclusive SQLite transaction to delete derived cache and replace the local
cursor with the high-water value. It does not delete the pending-mutation
table or local milestones. A subsequent ordinary sync receives only events
that raced after the high-water observation; all older server state is fetched
through existing authoritative reader APIs on demand.

No migration, deployment, production data access, signed build, or Play action
occurred. The new PostgreSQL integration assertion is CI-gated and skipped in
this local environment, so it is not represented as a rehearsal pass.

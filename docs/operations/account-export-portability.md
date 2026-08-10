# Account export v1 portability

## Current boundary

The account-data download is a private, one-time **access export**, not a
restorable backup. It is generated for the current authenticated reader,
returned as a no-store JSON attachment, and is never retained by Arctic RSS.
It does not include passwords, sessions, provider secrets, or publisher article
bodies.

Version 1 has no importer. It must not be presented as a way to restore an
account, migrate it into another reader, or recreate state after a deletion or
disaster-recovery event. OPML remains the portable export for subscriptions and
folder assignments.

## Why import is deferred

The v1 document contains bounded reader-owned references, some of which are
instance-local IDs. An importer would need an explicit, separately reviewed
contract for ownership, duplicate detection, collisions, version migration,
and conflicts before it could safely mutate an account.

If a future portable v2 is approved, it should use stable natural references
where possible: feed URLs, folder names plus stable export IDs, article
canonical/source URLs, and rule definitions expressed through stable source
references. It must define conflict handling and authorization before any
import endpoint or UI is added.

## Security and release boundary

The current route requires fresh authentication, enforces rate limits, and
returns only the documented bounded sections. This documentation does not add
an import, broaden the export, or imply that a local source test is a production
backup or recovery guarantee. Any release remains subject to current production
evidence and an exact approved `DEPLOY <short-sha>` command.

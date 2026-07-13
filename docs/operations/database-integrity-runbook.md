# Database integrity guardrails

The committed migrations add database-level protection that complements the
application ownership checks. They prevent a feed subscription from referring
to another user's folder, require every collection item to contain exactly one
supported target, prevent user accounts whose email addresses differ only by
case, and preserve administrator audit history when an actor account is
deleted.

## Pre-deployment gate

Run these read-only checks against production before applying the migration.
Each result must be zero. Do not copy user identifiers or email addresses into
task logs.

```sql
SELECT COUNT(*)
FROM "FeedSubscription" subscription
JOIN "Folder" folder ON folder.id = subscription."folderId"
WHERE subscription."folderId" IS NOT NULL
  AND subscription."userId" <> folder."userId";

SELECT COUNT(*)
FROM "ArticleCollectionItem"
WHERE (("articleId" IS NOT NULL)::integer +
       ("podcastEpisodeId" IS NOT NULL)::integer) <> 1;

SELECT COUNT(*)
FROM (
  SELECT lower(email)
  FROM "User"
  GROUP BY lower(email)
  HAVING COUNT(*) > 1
) collisions;

SELECT COUNT(*)
FROM "AdminAuditLog" AS log
LEFT JOIN "User" AS actor ON actor.id = log."adminUserId"
WHERE actor.id IS NULL;
```

The audit-history query must be zero before
`20260713190000_preserve_admin_audit_history` is applied. It confirms that
every existing record can receive an immutable actor snapshot.

## Audit evidence policy

The audit migration snapshots the acting administrator's ID, email, and name
when an event is created. The live user relation becomes nullable and uses
`ON DELETE SET NULL`, so removal of an account cannot remove prior evidence.
The database rejects audit-row edits and deletions; it permits only the
foreign-key action that clears the live relation after actor deletion.

## Deployment and rollback

Take a verified backup first, then apply the migration through the dedicated
production migration service. The application release contains an atomic folder
deletion path that clears a folder's subscriptions before deleting that folder.

Do not drop these constraints as a routine rollback. If a later release causes
a constraint failure, stop the affected write path, identify the invalid input,
and repair forward from a verified backup or a targeted maintenance migration.

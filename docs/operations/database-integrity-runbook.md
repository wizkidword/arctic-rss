# Database integrity guardrails

The committed migration `20260713180000_add_database_integrity_guards` adds
database-level protection that complements the application ownership checks.
It prevents a feed subscription from referring to another user's folder,
requires every collection item to contain exactly one supported target, and
prevents user accounts whose email addresses differ only by case.

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
```

## Deployment and rollback

Take a verified backup first, then apply the migration through the dedicated
production migration service. The application release contains an atomic folder
deletion path that clears a folder's subscriptions before deleting that folder.

Do not drop these constraints as a routine rollback. If a later release causes
a constraint failure, stop the affected write path, identify the invalid input,
and repair forward from a verified backup or a targeted maintenance migration.

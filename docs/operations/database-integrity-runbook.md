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

WITH source_counts AS (
  SELECT u.id, u.plan,
    (SELECT COUNT(*) FROM "FeedSubscription" s WHERE s."userId" = u.id) +
    (SELECT COUNT(*) FROM "PodcastSubscription" p WHERE p."userId" = u.id) AS source_count
  FROM "User" u
)
SELECT COUNT(*)
FROM source_counts
WHERE plan = 'FREE' AND source_count > 200;

WITH digest_counts AS (
  SELECT u.id, u.plan,
    (SELECT COUNT(*) FROM "SmartDigestRule" r WHERE r."userId" = u.id AND r."isEnabled") AS enabled_count
  FROM "User" u
)
SELECT COUNT(*)
FROM digest_counts
WHERE (plan = 'FREE' AND enabled_count > 1)
   OR (plan = 'PRO' AND enabled_count > 10);
```

The audit-history query must be zero before
`20260713190000_preserve_admin_audit_history` is applied. It confirms that
every existing record can receive an immutable actor snapshot.
The final two queries must be zero before
`20260713200000_make_plan_limits_atomic` is applied.

## Audit evidence policy

The audit migration snapshots the acting administrator's ID, email, and name
when an event is created. The live user relation becomes nullable and uses
`ON DELETE SET NULL`, so removal of an account cannot remove prior evidence.
The database rejects audit-row edits and deletions; it permits only the
foreign-key action that clears the live relation after actor deletion.

## Atomic plan limits

`UserPlanQuota` is a database-maintained per-user counter. Feed and podcast
subscription writes share one counter; enabled Smart Digests use a separate
counter. Conditional updates make the final available slot atomic, including
when requests arrive at the same time. AI usage already uses a separate,
period-based atomic reservation ledger.

## Deployment and rollback

Take a verified backup first, then apply the migration through the dedicated
production migration service. The application release contains an atomic folder
deletion path that clears a folder's subscriptions before deleting that folder.

Do not drop these constraints as a routine rollback. If a later release causes
a constraint failure, stop the affected write path, identify the invalid input,
and repair forward from a verified backup or a targeted maintenance migration.

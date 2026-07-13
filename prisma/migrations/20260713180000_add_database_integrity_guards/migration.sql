-- These guards make invalid cross-user links and malformed collection entries
-- impossible even if a future application path bypasses its ownership checks.
-- Production preflight queries must show zero violations before applying this.

ALTER TABLE "FeedSubscription"
DROP CONSTRAINT "FeedSubscription_folderId_fkey";

ALTER TABLE "FeedSubscription"
ADD CONSTRAINT "FeedSubscription_userId_folderId_fkey"
FOREIGN KEY ("userId", "folderId") REFERENCES "Folder"("userId", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ArticleCollectionItem"
ADD CONSTRAINT "ArticleCollectionItem_exactly_one_target"
CHECK (("articleId" IS NOT NULL)::integer + ("podcastEpisodeId" IS NOT NULL)::integer = 1);

-- Preserve the existing exact-match unique index while also preventing two
-- accounts whose email addresses differ only by letter case.
CREATE UNIQUE INDEX "User_email_lower_key" ON "User" (LOWER("email"));

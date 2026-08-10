-- Expand-only identity fields. Existing uniqueness continues to use the
-- bounded raw external ID until a separately reviewed index-and-switch release.
ALTER TABLE "Article" ADD COLUMN "externalIdHash" TEXT;

ALTER TABLE "PodcastEpisode" ADD COLUMN "externalIdHash" TEXT;

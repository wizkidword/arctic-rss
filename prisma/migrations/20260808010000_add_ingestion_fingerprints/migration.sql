-- Nullable expand-only columns let compatible application versions coexist.
-- Existing rows are populated lazily by their next ordinary source refresh.
ALTER TABLE "Article" ADD COLUMN "ingestionFingerprint" TEXT;

ALTER TABLE "PodcastEpisode" ADD COLUMN "ingestionFingerprint" TEXT;

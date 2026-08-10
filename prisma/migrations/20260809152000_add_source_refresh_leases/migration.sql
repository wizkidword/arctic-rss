-- Expand source ownership before workers begin fenced refresh claims.
-- The constant default is safe on supported PostgreSQL versions, but release
-- review must still measure the brief metadata lock on the source tables.
ALTER TABLE "Feed"
  ADD COLUMN "refreshGeneration" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "refreshOwner" TEXT,
  ADD COLUMN "refreshLeaseExpiresAt" TIMESTAMP(3),
  ADD COLUMN "refreshStartedAt" TIMESTAMP(3);

ALTER TABLE "Podcast"
  ADD COLUMN "refreshGeneration" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "refreshOwner" TEXT,
  ADD COLUMN "refreshLeaseExpiresAt" TIMESTAMP(3),
  ADD COLUMN "refreshStartedAt" TIMESTAMP(3);

-- Item generations remain nullable for an expand-only rollout. A current
-- refresh writes its source generation; legacy null rows are fenced on their
-- first normal refresh without an in-migration backfill.
ALTER TABLE "Article" ADD COLUMN "sourceGeneration" INTEGER;
ALTER TABLE "PodcastEpisode" ADD COLUMN "sourceGeneration" INTEGER;

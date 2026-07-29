-- A candidate key is unique to a reader, making initial automatic clustering
-- idempotent even when two requests race before either can create a cluster.
ALTER TABLE "StoryCluster" ADD COLUMN "deduplicationKey" TEXT;

-- No writer existed before the persistence service. This fallback still keeps
-- a partially staged database upgrade safe if an operator inserted a record.
UPDATE "StoryCluster"
SET "deduplicationKey" = 'legacy:' || "id"
WHERE "deduplicationKey" IS NULL;

ALTER TABLE "StoryCluster" ALTER COLUMN "deduplicationKey" SET NOT NULL;

-- Automated history needs the policy version that made the decision; manual
-- actions may intentionally leave this null.
ALTER TABLE "StoryClusterVersion" ADD COLUMN "algorithmVersion" TEXT;

CREATE UNIQUE INDEX "StoryCluster_userId_deduplicationKey_key"
  ON "StoryCluster"("userId", "deduplicationKey");

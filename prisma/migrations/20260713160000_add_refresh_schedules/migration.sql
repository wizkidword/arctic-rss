-- AlterTable
ALTER TABLE "Feed"
  ADD COLUMN "nextFetchAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "consecutiveFailures" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Podcast"
  ADD COLUMN "nextFetchAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "consecutiveFailures" INTEGER NOT NULL DEFAULT 0;

-- Backfill the first persisted schedule from the previous polling fields.
UPDATE "Feed"
SET
  "nextFetchAt" = COALESCE(
    "lastFetchedAt" + (GREATEST(5, LEAST("refreshIntervalMinutes", 1440)) * INTERVAL '1 minute'),
    "createdAt"
  ),
  "consecutiveFailures" = CASE WHEN "lastError" IS NULL THEN 0 ELSE 1 END;

UPDATE "Podcast"
SET
  "nextFetchAt" = COALESCE(
    "lastFetchedAt" + (GREATEST(5, LEAST("refreshIntervalMinutes", 1440)) * INTERVAL '1 minute'),
    "createdAt"
  ),
  "consecutiveFailures" = CASE WHEN "lastError" IS NULL THEN 0 ELSE 1 END;

-- CreateIndex
CREATE INDEX "Feed_nextFetchAt_id_idx" ON "Feed"("nextFetchAt", "id");

-- CreateIndex
CREATE INDEX "Podcast_nextFetchAt_id_idx" ON "Podcast"("nextFetchAt", "id");

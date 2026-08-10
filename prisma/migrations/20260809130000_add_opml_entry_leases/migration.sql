-- Expand OPML entry processing with nullable lease metadata before switching
-- workers to fenced claims. Existing pending and terminal entries retain their
-- current behavior until the compatible worker code is deployed.
ALTER TYPE "ImportEntryStatus" ADD VALUE 'PROCESSING';

ALTER TABLE "ImportJobEntry"
  ADD COLUMN "attempt" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "leaseOwner" TEXT,
  ADD COLUMN "leaseExpiresAt" TIMESTAMP(3),
  ADD COLUMN "processingStartedAt" TIMESTAMP(3);

CREATE INDEX "ImportJobEntry_importJobId_status_leaseExpiresAt_sequence_idx"
  ON "ImportJobEntry"("importJobId", "status", "leaseExpiresAt", "sequence");

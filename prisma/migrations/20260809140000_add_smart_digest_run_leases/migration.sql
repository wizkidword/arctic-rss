-- Expand Smart Digest run ownership before switching workers to fenced claims.
ALTER TABLE "DigestRun"
  ADD COLUMN "attempt" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "leaseOwner" TEXT,
  ADD COLUMN "leaseExpiresAt" TIMESTAMP(3),
  ADD COLUMN "lastHeartbeatAt" TIMESTAMP(3);

ALTER TABLE "SmartDigest" ADD COLUMN "runId" TEXT;

CREATE UNIQUE INDEX "SmartDigest_runId_key" ON "SmartDigest"("runId");
CREATE INDEX "DigestRun_status_leaseExpiresAt_idx" ON "DigestRun"("status", "leaseExpiresAt");

-- Existing digests use DigestRun.digestId. New fenced workers set runId; the
-- constraint is intentionally introduced without validation so production
-- validation can be separately timed against current table size and workload.
ALTER TABLE "SmartDigest"
  ADD CONSTRAINT "SmartDigest_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "DigestRun"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;

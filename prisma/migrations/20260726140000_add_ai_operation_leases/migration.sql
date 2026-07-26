-- AI operations reserve quota before a provider request. These expand-only
-- columns allow a later worker to safely take over an expired operation while
-- preventing a superseded worker from completing or releasing it.
ALTER TABLE "AiOperation"
  ADD COLUMN "leaseOwner" TEXT,
  ADD COLUMN "leaseExpiresAt" TIMESTAMP(3),
  ADD COLUMN "attempt" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastHeartbeatAt" TIMESTAMP(3),
  ADD COLUMN "retryableAt" TIMESTAMP(3);

CREATE INDEX "AiOperation_status_leaseExpiresAt_idx"
  ON "AiOperation"("status", "leaseExpiresAt");

CREATE INDEX "AiOperation_retryableAt_idx"
  ON "AiOperation"("retryableAt");

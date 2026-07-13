-- Durable idempotency records for scheduled Smart Digest generation and delivery.
CREATE TYPE "DigestRunStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

ALTER TABLE "SmartDigestRule"
ADD COLUMN "contentWatermarkAt" TIMESTAMP(3);

-- Existing schedules continue from their most recent completed run.
UPDATE "SmartDigestRule"
SET "contentWatermarkAt" = "lastRunAt"
WHERE "contentWatermarkAt" IS NULL
  AND "lastRunAt" IS NOT NULL;

CREATE TABLE "DigestRun" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" "DigestRunStatus" NOT NULL DEFAULT 'PENDING',
    "processingStartedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "watermarkFrom" TIMESTAMP(3),
    "watermarkTo" TIMESTAMP(3),
    "digestId" TEXT,
    "emailStatus" TEXT DEFAULT 'NOT_REQUESTED',
    "providerMessageId" TEXT,
    "emailAttemptedAt" TIMESTAMP(3),
    "emailDeliveredAt" TIMESTAMP(3),
    "emailAttempts" INTEGER NOT NULL DEFAULT 0,
    "emailErrorMessage" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DigestRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DigestRun_ruleId_scheduledFor_key" ON "DigestRun"("ruleId", "scheduledFor");
CREATE UNIQUE INDEX "DigestRun_digestId_key" ON "DigestRun"("digestId");
CREATE INDEX "DigestRun_status_processingStartedAt_idx" ON "DigestRun"("status", "processingStartedAt");
CREATE INDEX "DigestRun_emailStatus_createdAt_idx" ON "DigestRun"("emailStatus", "createdAt");

ALTER TABLE "DigestRun"
ADD CONSTRAINT "DigestRun_ruleId_fkey"
FOREIGN KEY ("ruleId") REFERENCES "SmartDigestRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DigestRun"
ADD CONSTRAINT "DigestRun_digestId_fkey"
FOREIGN KEY ("digestId") REFERENCES "SmartDigest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

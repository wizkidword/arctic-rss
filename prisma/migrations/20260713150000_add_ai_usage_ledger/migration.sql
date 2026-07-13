-- CreateEnum
CREATE TYPE "AiOperationStatus" AS ENUM ('RESERVED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "AiUsagePeriod" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "limitUnits" INTEGER NOT NULL,
    "reservedUnits" INTEGER NOT NULL DEFAULT 0,
    "consumedUnits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiUsagePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiOperation" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodId" TEXT,
    "action" "AiAction" NOT NULL,
    "status" "AiOperationStatus" NOT NULL DEFAULT 'RESERVED',
    "reservedUnits" INTEGER NOT NULL DEFAULT 0,
    "consumedUnits" INTEGER NOT NULL DEFAULT 0,
    "provider" TEXT,
    "model" TEXT,
    "providerRequestId" TEXT,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AiOperation_pkey" PRIMARY KEY ("id")
);

-- Backfill the current UTC month from the append-only usage log. The legacy
-- User.aiMonthlyUsed scalar is intentionally not used: it has no period and
-- may include prior months.
WITH current_period AS (
  SELECT date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::timestamp(3) AS "periodStart"
)
INSERT INTO "AiUsagePeriod" (
  "id",
  "userId",
  "periodStart",
  "limitUnits",
  "reservedUnits",
  "consumedUnits",
  "createdAt",
  "updatedAt"
)
SELECT
  md5('ai-usage-period:' || "User"."id" || ':' || current_period."periodStart"::text),
  "User"."id",
  current_period."periodStart",
  "User"."aiMonthlyLimit",
  0,
  COUNT("AiUsageLog"."id")::integer,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "User"
CROSS JOIN current_period
LEFT JOIN "AiUsageLog"
  ON "AiUsageLog"."userId" = "User"."id"
  AND "AiUsageLog"."createdAt" >= current_period."periodStart"
GROUP BY "User"."id", "User"."aiMonthlyLimit", current_period."periodStart";

-- CreateIndex
CREATE UNIQUE INDEX "AiUsagePeriod_userId_periodStart_key" ON "AiUsagePeriod"("userId", "periodStart");

-- CreateIndex
CREATE INDEX "AiUsagePeriod_periodStart_idx" ON "AiUsagePeriod"("periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "AiOperation_idempotencyKey_key" ON "AiOperation"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AiOperation_userId_createdAt_idx" ON "AiOperation"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiOperation_periodId_status_idx" ON "AiOperation"("periodId", "status");

-- Prevent two simultaneous browser requests from creating separate active
-- digests for the same user. Completed and failed digests remain historical.
CREATE UNIQUE INDEX "AiDigest_one_active_per_user" ON "AiDigest"("userId")
WHERE "status" IN ('PENDING', 'PROCESSING');

-- AddForeignKey
ALTER TABLE "AiUsagePeriod" ADD CONSTRAINT "AiUsagePeriod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiOperation" ADD CONSTRAINT "AiOperation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiOperation" ADD CONSTRAINT "AiOperation_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AiUsagePeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

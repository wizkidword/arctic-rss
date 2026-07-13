ALTER TYPE "ImportStatus" ADD VALUE 'CANCELED';

CREATE TYPE "ImportEntryStatus" AS ENUM (
  'PENDING',
  'ADDED',
  'SKIPPED',
  'FAILED'
);

ALTER TABLE "ImportJob"
  ADD COLUMN "processedFeeds" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "folderCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "cancelRequestedAt" TIMESTAMP(3),
  ADD COLUMN "startedAt" TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "lastError" TEXT;

UPDATE "ImportJob"
SET "processedFeeds" = "addedFeeds" + "skippedFeeds" + "failedFeeds";

ALTER TABLE "ImportJob"
  ADD CONSTRAINT "ImportJob_counts_valid" CHECK (
    "totalFeeds" >= 0
    AND "processedFeeds" >= 0
    AND "addedFeeds" >= 0
    AND "skippedFeeds" >= 0
    AND "failedFeeds" >= 0
    AND "folderCount" >= 0
    AND "processedFeeds" <= "totalFeeds"
    AND "addedFeeds" + "skippedFeeds" + "failedFeeds" <= "processedFeeds"
  ) NOT VALID;

CREATE TABLE "ImportJobEntry" (
  "id" TEXT NOT NULL,
  "importJobId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "folderName" TEXT,
  "title" TEXT NOT NULL,
  "xmlUrl" TEXT NOT NULL,
  "status" "ImportEntryStatus" NOT NULL DEFAULT 'PENDING',
  "errorMessage" TEXT,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ImportJobEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ImportJobEntry_importJobId_sequence_key"
ON "ImportJobEntry"("importJobId", "sequence");

CREATE INDEX "ImportJob_userId_status_updatedAt_idx"
ON "ImportJob"("userId", "status", "updatedAt");

CREATE INDEX "ImportJob_status_updatedAt_idx"
ON "ImportJob"("status", "updatedAt");

CREATE INDEX "ImportJobEntry_importJobId_status_sequence_idx"
ON "ImportJobEntry"("importJobId", "status", "sequence");

ALTER TABLE "ImportJobEntry"
ADD CONSTRAINT "ImportJobEntry_importJobId_fkey"
FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

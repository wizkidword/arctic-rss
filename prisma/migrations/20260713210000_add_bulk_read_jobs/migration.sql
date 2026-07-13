CREATE TYPE "BulkReadJobStatus" AS ENUM (
  'QUEUED',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'CANCELED'
);

CREATE TABLE "BulkReadJob" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "scopeType" TEXT NOT NULL,
  "feedId" TEXT,
  "folderId" TEXT,
  "status" "BulkReadJobStatus" NOT NULL DEFAULT 'QUEUED',
  "totalArticles" INTEGER NOT NULL,
  "processedArticles" INTEGER NOT NULL DEFAULT 0,
  "markedArticles" INTEGER NOT NULL DEFAULT 0,
  "lastArticleId" TEXT,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "canceledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BulkReadJob_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BulkReadJob_scope_valid" CHECK (
    ("scopeType" = 'all' AND "feedId" IS NULL AND "folderId" IS NULL)
    OR ("scopeType" = 'feed' AND "feedId" IS NOT NULL AND "folderId" IS NULL)
    OR ("scopeType" = 'folder' AND "feedId" IS NULL AND "folderId" IS NOT NULL)
  ),
  CONSTRAINT "BulkReadJob_counts_valid" CHECK (
    "totalArticles" >= 0
    AND "processedArticles" >= 0
    AND "markedArticles" >= 0
    AND "processedArticles" <= "totalArticles"
    AND "markedArticles" <= "processedArticles"
  )
);

ALTER TABLE "BulkReadJob"
ADD CONSTRAINT "BulkReadJob_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "BulkReadJob_userId_status_updatedAt_idx"
ON "BulkReadJob"("userId", "status", "updatedAt");

CREATE INDEX "BulkReadJob_status_updatedAt_idx"
ON "BulkReadJob"("status", "updatedAt");

-- Durable, resumable progress for the loopback-only external identity hash
-- backfill. The nullable identity columns remain separately releasable.
CREATE TABLE "ExternalIdentityHashBackfillProgress" (
    "scope" TEXT NOT NULL,
    "cursorId" TEXT,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "collisionCandidateCount" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalIdentityHashBackfillProgress_pkey" PRIMARY KEY ("scope")
);

-- Saved searches persist only the current reader-search definition. They do
-- not own scheduled execution, notifications, or article results.
CREATE TABLE "SavedSearch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "definitionVersion" INTEGER NOT NULL DEFAULT 1,
    "query" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'all',
    "subscriptionId" TEXT,
    "folderId" TEXT,
    "collectionId" TEXT,
    "publishedAfter" TIMESTAMP(3),
    "publishedBefore" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SavedSearch_userId_id_key" ON "SavedSearch"("userId", "id");
CREATE INDEX "SavedSearch_userId_updatedAt_idx" ON "SavedSearch"("userId", "updatedAt");

ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

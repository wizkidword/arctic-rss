-- Story clustering is user-scoped so a user's feed visibility and corrections
-- never affect another user's reader. The records below only add history; they
-- do not alter, hide, or delete Article rows.
CREATE TYPE "StoryClusterStatus" AS ENUM ('ACTIVE', 'DISMISSED');

CREATE TYPE "StoryClusterVersionAction" AS ENUM (
    'CREATED',
    'RERUN',
    'MERGED',
    'SPLIT',
    'DISMISSED',
    'RESTORED'
);

CREATE TYPE "StoryClusterSignal" AS ENUM (
    'CANONICAL_URL',
    'NORMALIZED_TITLE',
    'PUBLICATION_TIME_WINDOW',
    'SHARED_NAMED_ENTITIES',
    'TEXT_SIMILARITY',
    'SOURCE_DUPLICATION'
);

CREATE TABLE "StoryCluster" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "StoryClusterStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentVersionNumber" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryCluster_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoryClusterVersion" (
    "id" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "action" "StoryClusterVersionAction" NOT NULL,
    "deduplicationKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoryClusterVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoryClusterMember" (
    "id" TEXT NOT NULL,
    "clusterVersionId" TEXT NOT NULL,
    "articleId" TEXT,
    "articleTitle" TEXT NOT NULL,
    "articleUrl" TEXT NOT NULL,
    "feedTitle" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoryClusterMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoryClusterEvidence" (
    "id" TEXT NOT NULL,
    "clusterVersionId" TEXT NOT NULL,
    "leftMemberId" TEXT NOT NULL,
    "rightMemberId" TEXT NOT NULL,
    "signal" "StoryClusterSignal" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoryClusterEvidence_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StoryClusterEvidence_distinctMembers_check"
      CHECK ("leftMemberId" <> "rightMemberId")
);

CREATE UNIQUE INDEX "StoryCluster_userId_id_key" ON "StoryCluster"("userId", "id");
CREATE INDEX "StoryCluster_userId_status_updatedAt_idx" ON "StoryCluster"("userId", "status", "updatedAt");

CREATE UNIQUE INDEX "StoryClusterVersion_clusterId_version_key"
  ON "StoryClusterVersion"("clusterId", "version");
CREATE UNIQUE INDEX "StoryClusterVersion_clusterId_deduplicationKey_key"
  ON "StoryClusterVersion"("clusterId", "deduplicationKey");
CREATE INDEX "StoryClusterVersion_clusterId_createdAt_idx"
  ON "StoryClusterVersion"("clusterId", "createdAt");

CREATE UNIQUE INDEX "StoryClusterMember_clusterVersionId_articleId_key"
  ON "StoryClusterMember"("clusterVersionId", "articleId");
CREATE INDEX "StoryClusterMember_articleId_idx" ON "StoryClusterMember"("articleId");

CREATE UNIQUE INDEX "StoryClusterEvidence_clusterVersionId_leftMemberId_rightMem_key"
  ON "StoryClusterEvidence"("clusterVersionId", "leftMemberId", "rightMemberId", "signal");
CREATE INDEX "StoryClusterEvidence_clusterVersionId_idx"
  ON "StoryClusterEvidence"("clusterVersionId");

ALTER TABLE "StoryCluster" ADD CONSTRAINT "StoryCluster_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StoryClusterVersion" ADD CONSTRAINT "StoryClusterVersion_clusterId_fkey"
  FOREIGN KEY ("clusterId") REFERENCES "StoryCluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StoryClusterMember" ADD CONSTRAINT "StoryClusterMember_clusterVersionId_fkey"
  FOREIGN KEY ("clusterVersionId") REFERENCES "StoryClusterVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StoryClusterMember" ADD CONSTRAINT "StoryClusterMember_articleId_fkey"
  FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StoryClusterEvidence" ADD CONSTRAINT "StoryClusterEvidence_clusterVersionId_fkey"
  FOREIGN KEY ("clusterVersionId") REFERENCES "StoryClusterVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StoryClusterEvidence" ADD CONSTRAINT "StoryClusterEvidence_leftMemberId_fkey"
  FOREIGN KEY ("leftMemberId") REFERENCES "StoryClusterMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StoryClusterEvidence" ADD CONSTRAINT "StoryClusterEvidence_rightMemberId_fkey"
  FOREIGN KEY ("rightMemberId") REFERENCES "StoryClusterMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

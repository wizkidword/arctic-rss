-- Cited story analysis is a distinct billable AI action so reader-triggered
-- comparisons remain visible in the existing allowance ledger.
ALTER TYPE "AiAction" ADD VALUE IF NOT EXISTS 'STORY_COMPARISON';

CREATE TYPE "StoryClusterAnalysisClaimKind" AS ENUM (
  'LATEST_DEVELOPMENT',
  'NEW_FACT',
  'CORRECTION',
  'REPEATED_CLAIM',
  'DISAGREEMENT'
);

CREATE TABLE "StoryClusterAnalysis" (
    "id" TEXT NOT NULL,
    "clusterVersionId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "sourceCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoryClusterAnalysis_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoryClusterAnalysisClaim" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "kind" "StoryClusterAnalysisClaimKind" NOT NULL,
    "statement" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoryClusterAnalysisClaim_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoryClusterAnalysisCitation" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoryClusterAnalysisCitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StoryClusterAnalysis_clusterVersionId_provider_model_prompt_key"
  ON "StoryClusterAnalysis"("clusterVersionId", "provider", "model", "promptVersion");
CREATE INDEX "StoryClusterAnalysis_clusterVersionId_createdAt_idx"
  ON "StoryClusterAnalysis"("clusterVersionId", "createdAt");

CREATE UNIQUE INDEX "StoryClusterAnalysisClaim_analysisId_position_key"
  ON "StoryClusterAnalysisClaim"("analysisId", "position");
CREATE INDEX "StoryClusterAnalysisClaim_analysisId_idx"
  ON "StoryClusterAnalysisClaim"("analysisId");

CREATE UNIQUE INDEX "StoryClusterAnalysisCitation_claimId_memberId_key"
  ON "StoryClusterAnalysisCitation"("claimId", "memberId");
CREATE UNIQUE INDEX "StoryClusterAnalysisCitation_claimId_position_key"
  ON "StoryClusterAnalysisCitation"("claimId", "position");
CREATE INDEX "StoryClusterAnalysisCitation_memberId_idx"
  ON "StoryClusterAnalysisCitation"("memberId");

ALTER TABLE "StoryClusterAnalysis"
  ADD CONSTRAINT "StoryClusterAnalysis_clusterVersionId_fkey"
  FOREIGN KEY ("clusterVersionId") REFERENCES "StoryClusterVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StoryClusterAnalysisClaim"
  ADD CONSTRAINT "StoryClusterAnalysisClaim_analysisId_fkey"
  FOREIGN KEY ("analysisId") REFERENCES "StoryClusterAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StoryClusterAnalysisCitation"
  ADD CONSTRAINT "StoryClusterAnalysisCitation_claimId_fkey"
  FOREIGN KEY ("claimId") REFERENCES "StoryClusterAnalysisClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StoryClusterAnalysisCitation"
  ADD CONSTRAINT "StoryClusterAnalysisCitation_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "StoryClusterMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

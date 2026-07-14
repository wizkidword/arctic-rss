-- ArcticIRC policy activation is additive and remains dormant while the
-- feature flag is false. This stores only the required versioned attestations,
-- never a date of birth.
CREATE TABLE "ChatPolicyAcceptance" (
    "userId" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ageAttestedAt" TIMESTAMP(3) NOT NULL,
    "termsAcceptedAt" TIMESTAMP(3) NOT NULL,
    "communityAcceptedAt" TIMESTAMP(3) NOT NULL,
    "privacyAcceptedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatPolicyAcceptance_pkey" PRIMARY KEY ("userId")
);

CREATE INDEX "ChatPolicyAcceptance_policyVersion_acceptedAt_idx"
  ON "ChatPolicyAcceptance"("policyVersion", "acceptedAt");

ALTER TABLE "ChatPolicyAcceptance"
  ADD CONSTRAINT "ChatPolicyAcceptance_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatProfile"
  ADD COLUMN "personalizedDiscovery" BOOLEAN NOT NULL DEFAULT true;

CREATE TYPE "ChatReportRetentionClass" AS ENUM ('ORDINARY', 'SERIOUS');

ALTER TABLE "ChatReport"
  ADD COLUMN "retentionClass" "ChatReportRetentionClass" NOT NULL DEFAULT 'ORDINARY',
  ADD COLUMN "closedAt" TIMESTAMP(3);

CREATE INDEX "ChatReport_closedAt_retentionClass_idx"
  ON "ChatReport"("closedAt", "retentionClass");

CREATE TABLE "ChatReportEvidence" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatReportEvidence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChatReportEvidence_reportId_key" ON "ChatReportEvidence"("reportId");
CREATE INDEX "ChatReportEvidence_createdAt_idx" ON "ChatReportEvidence"("createdAt");

INSERT INTO "ChatReportEvidence" ("id", "reportId", "snapshot", "createdAt", "updatedAt")
SELECT CONCAT('migrated-evidence-', "id"), "id", "evidenceSnapshot", "createdAt", "updatedAt"
FROM "ChatReport"
WHERE "evidenceSnapshot" IS NOT NULL;

ALTER TABLE "ChatReportEvidence"
  ADD CONSTRAINT "ChatReportEvidence_reportId_fkey"
  FOREIGN KEY ("reportId") REFERENCES "ChatReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatReport" DROP COLUMN "evidenceSnapshot";

CREATE TYPE "ChatLegalHoldSubject" AS ENUM ('CHAT_AUDIT_LOG', 'CHAT_MESSAGE', 'CHAT_REPORT');

CREATE TABLE "ChatLegalHold" (
    "id" TEXT NOT NULL,
    "subjectType" "ChatLegalHoldSubject" NOT NULL,
    "subjectId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "authorizedByUserId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewAt" TIMESTAMP(3) NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatLegalHold_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChatLegalHold_subjectType_subjectId_releasedAt_idx"
  ON "ChatLegalHold"("subjectType", "subjectId", "releasedAt");
CREATE INDEX "ChatLegalHold_releasedAt_reviewAt_idx"
  ON "ChatLegalHold"("releasedAt", "reviewAt");

CREATE TABLE "AccountDeletionRecord" (
    "id" TEXT NOT NULL,
    "subjectReference" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountDeletionRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccountDeletionRecord_subjectReference_key"
  ON "AccountDeletionRecord"("subjectReference");
CREATE INDEX "AccountDeletionRecord_completedAt_idx"
  ON "AccountDeletionRecord"("completedAt");

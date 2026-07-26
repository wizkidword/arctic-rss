-- CHAT-MOD-001 is an expand-only migration. Existing v1 JSON snapshots are
-- intentionally not reconstructed: a later message deletion may have removed
-- the source content, so they remain clearly marked LEGACY_PARTIAL.
ALTER TABLE "ChatMessage"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

CREATE TYPE "ChatReportEvidenceCaptureState" AS ENUM (
  'LEGACY_PARTIAL',
  'CAPTURED',
  'NOT_APPLICABLE'
);

ALTER TABLE "ChatReportEvidence"
  ADD COLUMN "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "captureState" "ChatReportEvidenceCaptureState" NOT NULL DEFAULT 'LEGACY_PARTIAL',
  ADD COLUMN "contentHash" TEXT,
  ADD COLUMN "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- New Prisma clients intentionally omit the legacy physical updatedAt column.
-- Give that column a database default before the application starts creating
-- versioned evidence rows through the expanded model.
ALTER TABLE "ChatReportEvidence"
  ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "ChatReportEvidence_captureState_capturedAt_idx"
  ON "ChatReportEvidence"("captureState", "capturedAt");

-- Evidence is immutable after capture. Deletion remains possible through the
-- parent report's cascade when retention permits it or when a legal hold is
-- released, but the evidence row itself cannot be modified in place.
CREATE OR REPLACE FUNCTION prevent_chat_report_evidence_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Chat report evidence is immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ChatReportEvidence_prevent_update"
BEFORE UPDATE ON "ChatReportEvidence"
FOR EACH ROW
EXECUTE FUNCTION prevent_chat_report_evidence_update();

-- Saved monitors are an explicit opt-in extension of the existing private,
-- versioned SavedSearch definition. The initial slice records only in-app
-- new-match counts; it deliberately does not enable AI, email, webhooks, or
-- reader automation.
ALTER TABLE "SavedSearch"
  ADD COLUMN "monitorEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "monitorNewMatchCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "monitorLastRunAt" TIMESTAMP(3),
  ADD COLUMN "monitorNextRunAt" TIMESTAMP(3),
  ADD COLUMN "monitorCursorCreatedAt" TIMESTAMP(3),
  ADD COLUMN "monitorCursorArticleId" TEXT;

CREATE INDEX "SavedSearch_monitorEnabled_monitorNextRunAt_idx"
  ON "SavedSearch"("monitorEnabled", "monitorNextRunAt");

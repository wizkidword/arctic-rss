-- A monitor's normal interval and its retry state are deliberately separate.
-- Existing monitorLastRunAt remains the last successful run, while this field
-- records consecutive failures so recovery can use a bounded backoff.
ALTER TABLE "SavedSearch"
  ADD COLUMN "monitorFailureCount" INTEGER NOT NULL DEFAULT 0;

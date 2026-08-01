-- Existing saved monitors count new matches. The first automation action is
-- intentionally additive: it stars only future matches after the monitor's
-- existing cursor, never altering the historical reader state on enable.
ALTER TABLE "SavedSearch"
  ADD COLUMN "monitorAction" TEXT NOT NULL DEFAULT 'count';

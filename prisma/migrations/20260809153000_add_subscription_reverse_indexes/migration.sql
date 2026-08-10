-- Subscription reverse lookups are used by shared-source checks and the
-- orphan-retention report. These indexes must remain concurrent: the source
-- tables can be material, and a regular index build would block writers.
CREATE INDEX CONCURRENTLY "FeedSubscription_feedId_idx"
  ON "FeedSubscription"("feedId");

CREATE INDEX CONCURRENTLY "PodcastSubscription_podcastId_idx"
  ON "PodcastSubscription"("podcastId");

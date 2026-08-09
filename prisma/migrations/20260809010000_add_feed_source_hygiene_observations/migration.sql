ALTER TABLE "Feed"
  ADD COLUMN "lastRecoveredAt" TIMESTAMP(3),
  ADD COLUMN "lastResolvedFeedUrl" TEXT,
  ADD COLUMN "previousResolvedFeedUrl" TEXT,
  ADD COLUMN "lastPermanentRedirectUrl" TEXT,
  ADD COLUMN "lastFeedSelfUrl" TEXT,
  ADD COLUMN "previousFeedSelfUrl" TEXT,
  ADD COLUMN "lastSourceUrlObservedAt" TIMESTAMP(3);

ALTER TABLE "FeedSubscription"
  ADD COLUMN "lastSourceAttentionReviewedAt" TIMESTAMP(3),
  ADD COLUMN "previousFeedUrl" TEXT,
  ADD COLUMN "previousFeedUrlChangedAt" TIMESTAMP(3);

-- Phase 12 keeps mobile retry and sync state additive. Existing application
-- tables remain the source of truth; these tables only record compact changes.
CREATE TABLE "DeviceMutationReceipt" (
    "id" TEXT NOT NULL,
    "deviceSessionId" TEXT NOT NULL,
    "idempotencyKeyHash" VARCHAR(64) NOT NULL,
    "operation" VARCHAR(80) NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,
    "resultCode" VARCHAR(32) NOT NULL DEFAULT 'OK',
    "resultReference" VARCHAR(128),
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceMutationReceipt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeviceInstallation" (
    "id" TEXT NOT NULL,
    "deviceSessionId" TEXT NOT NULL,
    "platform" VARCHAR(32) NOT NULL,
    "environment" VARCHAR(32) NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "disabledAt" TIMESTAMP(3),
    "unregisteredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceInstallation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserNotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topic" VARCHAR(64) NOT NULL,
    "channel" VARCHAR(32) NOT NULL DEFAULT 'IN_APP',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserNotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserSyncEvent" (
    "sequence" BIGSERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "resourceType" VARCHAR(64) NOT NULL,
    "resourceId" VARCHAR(128) NOT NULL,
    "action" VARCHAR(16) NOT NULL,
    "resourceVersion" VARCHAR(64) NOT NULL,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSyncEvent_pkey" PRIMARY KEY ("sequence")
);

CREATE TABLE "UserSyncCursorFloor" (
    "userId" TEXT NOT NULL,
    "minimumSequence" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSyncCursorFloor_pkey" PRIMARY KEY ("userId")
);

CREATE UNIQUE INDEX "DeviceMutationReceipt_deviceSessionId_idempotencyKeyHash_key"
    ON "DeviceMutationReceipt"("deviceSessionId", "idempotencyKeyHash");
CREATE INDEX "DeviceMutationReceipt_createdAt_idx" ON "DeviceMutationReceipt"("createdAt");
CREATE UNIQUE INDEX "DeviceInstallation_tokenHash_key" ON "DeviceInstallation"("tokenHash");
CREATE INDEX "DeviceInstallation_deviceSessionId_disabledAt_idx"
    ON "DeviceInstallation"("deviceSessionId", "disabledAt");
CREATE INDEX "DeviceInstallation_lastSeenAt_idx" ON "DeviceInstallation"("lastSeenAt");
CREATE UNIQUE INDEX "UserNotificationPreference_userId_topic_key"
    ON "UserNotificationPreference"("userId", "topic");
CREATE INDEX "UserNotificationPreference_userId_updatedAt_idx"
    ON "UserNotificationPreference"("userId", "updatedAt");
CREATE INDEX "UserSyncEvent_userId_sequence_idx" ON "UserSyncEvent"("userId", "sequence");
CREATE INDEX "UserSyncEvent_userId_occurredAt_idx" ON "UserSyncEvent"("userId", "occurredAt");
CREATE INDEX "UserSyncEvent_occurredAt_idx" ON "UserSyncEvent"("occurredAt");

ALTER TABLE "DeviceMutationReceipt" ADD CONSTRAINT "DeviceMutationReceipt_deviceSessionId_fkey"
    FOREIGN KEY ("deviceSessionId") REFERENCES "DeviceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeviceInstallation" ADD CONSTRAINT "DeviceInstallation_deviceSessionId_fkey"
    FOREIGN KEY ("deviceSessionId") REFERENCES "DeviceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserNotificationPreference" ADD CONSTRAINT "UserNotificationPreference_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserSyncEvent" ADD CONSTRAINT "UserSyncEvent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserSyncCursorFloor" ADD CONSTRAINT "UserSyncCursorFloor_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A per-user 180-day window is enough for ordinary device inactivity while
-- keeping the append-only journal bounded. An older cursor receives the
-- explicit full-resync response rather than a partial, misleading delta.
CREATE OR REPLACE FUNCTION "append_user_sync_event"(
  p_user_id TEXT,
  p_resource_type TEXT,
  p_resource_id TEXT,
  p_action TEXT,
  p_resource_version TEXT,
  p_payload JSONB
) RETURNS VOID AS $$
BEGIN
  INSERT INTO "UserSyncEvent" (
    "userId", "resourceType", "resourceId", "action", "resourceVersion", "payload"
  ) VALUES (
    p_user_id, p_resource_type, p_resource_id, p_action, p_resource_version, p_payload
  );

  WITH removed AS (
    DELETE FROM "UserSyncEvent"
    WHERE "userId" = p_user_id
      AND "occurredAt" < CURRENT_TIMESTAMP - INTERVAL '180 days'
    RETURNING "sequence"
  ), floor AS (
    SELECT COALESCE(MAX("sequence") + 1, 0) AS "minimumSequence" FROM removed
  )
  INSERT INTO "UserSyncCursorFloor" ("userId", "minimumSequence", "updatedAt")
  SELECT p_user_id, "minimumSequence", CURRENT_TIMESTAMP FROM floor
  WHERE "minimumSequence" > 0
  ON CONFLICT ("userId") DO UPDATE
  SET "minimumSequence" = GREATEST("UserSyncCursorFloor"."minimumSequence", EXCLUDED."minimumSequence"),
      "updatedAt" = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Cascading user deletion is intentionally not a client-visible tombstone
-- stream. Mark it for the transaction so child-table triggers do not create
-- rows that the original cascade set could not see and therefore cannot remove.
CREATE OR REPLACE FUNCTION "suppress_user_sync_events_on_delete"() RETURNS TRIGGER AS $$
BEGIN
  PERFORM set_config('arctic_rss.deleting_user_id', OLD."id", true);
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "sync_article_state_change"() RETURNS TRIGGER AS $$
DECLARE
  record_id TEXT;
  version TEXT;
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('arctic_rss.deleting_user_id', true) = OLD."userId" THEN
    RETURN OLD;
  END IF;
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM "User" WHERE "id" = OLD."userId") THEN
    RETURN OLD;
  END IF;
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;
  IF TG_OP = 'DELETE' THEN
    record_id := OLD."articleId";
    version := OLD."updatedAt"::TEXT;
    PERFORM "append_user_sync_event"(OLD."userId", 'article-state', record_id, 'TOMBSTONE', version,
      jsonb_build_object('articleId', OLD."articleId"));
    RETURN OLD;
  END IF;

  record_id := NEW."articleId";
  version := NEW."updatedAt"::TEXT;
  PERFORM "append_user_sync_event"(NEW."userId", 'article-state', record_id, 'UPSERT', version,
    jsonb_build_object(
      'archivedAt', NEW."archivedAt",
      'articleId', NEW."articleId",
      'isRead', NEW."isRead",
      'isStarred', NEW."isStarred",
      'readAt', NEW."readAt",
      'starredAt', NEW."starredAt"
    ));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "sync_collection_item_change"() RETURNS TRIGGER AS $$
DECLARE
  owner_id TEXT;
  collection_id TEXT;
  item_id TEXT;
  article_id TEXT;
  episode_id TEXT;
  version TEXT;
  event_action TEXT;
BEGIN
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;
  IF TG_OP = 'DELETE' THEN
    collection_id := OLD."collectionId";
    item_id := OLD."id";
    article_id := OLD."articleId";
    episode_id := OLD."podcastEpisodeId";
    version := OLD."createdAt"::TEXT;
    event_action := 'TOMBSTONE';
  ELSE
    collection_id := NEW."collectionId";
    item_id := NEW."id";
    article_id := NEW."articleId";
    episode_id := NEW."podcastEpisodeId";
    version := NEW."createdAt"::TEXT;
    event_action := 'UPSERT';
  END IF;
  SELECT "userId" INTO owner_id FROM "ArticleCollection" WHERE "id" = collection_id;
  IF owner_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' AND current_setting('arctic_rss.deleting_user_id', true) = owner_id THEN
    RETURN OLD;
  END IF;
  PERFORM "append_user_sync_event"(owner_id, 'collection-item', item_id, event_action, version,
    jsonb_strip_nulls(jsonb_build_object(
      'articleId', article_id,
      'collectionId', collection_id,
      'itemId', item_id,
      'podcastEpisodeId', episode_id
    )));
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "sync_podcast_episode_state_change"() RETURNS TRIGGER AS $$
DECLARE
  record_id TEXT;
  version TEXT;
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('arctic_rss.deleting_user_id', true) = OLD."userId" THEN
    RETURN OLD;
  END IF;
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM "User" WHERE "id" = OLD."userId") THEN
    RETURN OLD;
  END IF;
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;
  IF TG_OP = 'DELETE' THEN
    PERFORM "append_user_sync_event"(OLD."userId", 'podcast-episode-state', OLD."episodeId", 'TOMBSTONE', OLD."updatedAt"::TEXT,
      jsonb_build_object('episodeId', OLD."episodeId"));
    RETURN OLD;
  END IF;

  record_id := NEW."episodeId";
  version := NEW."updatedAt"::TEXT;
  PERFORM "append_user_sync_event"(NEW."userId", 'podcast-episode-state', record_id, 'UPSERT', version,
    jsonb_build_object(
      'episodeId', NEW."episodeId",
      'isPlayed', NEW."isPlayed",
      'isStarred', NEW."isStarred",
      'playedAt', NEW."playedAt",
      'playbackPositionSeconds', NEW."playbackPositionSeconds",
      'starredAt', NEW."starredAt"
    ));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "sync_user_owned_row_change"() RETURNS TRIGGER AS $$
DECLARE
  owner_id TEXT;
  record_id TEXT;
  version TEXT;
  event_action TEXT;
  resource_type TEXT;
  payload JSONB;
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('arctic_rss.deleting_user_id', true) = OLD."userId" THEN
    RETURN OLD;
  END IF;
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM "User" WHERE "id" = OLD."userId") THEN
    RETURN OLD;
  END IF;
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;
  IF TG_OP = 'DELETE' THEN
    owner_id := OLD."userId";
    record_id := OLD."id";
    version := COALESCE(OLD."updatedAt", OLD."createdAt")::TEXT;
    event_action := 'TOMBSTONE';
  ELSE
    owner_id := NEW."userId";
    record_id := NEW."id";
    version := COALESCE(NEW."updatedAt", NEW."createdAt")::TEXT;
    event_action := 'UPSERT';
  END IF;
  resource_type := TG_ARGV[0];
  payload := jsonb_build_object('id', record_id);
  IF resource_type = 'feed-subscription' THEN
    IF TG_OP = 'DELETE' THEN
      payload := jsonb_build_object('feedId', OLD."feedId", 'subscriptionId', record_id);
    ELSE
      payload := jsonb_build_object('feedId', NEW."feedId", 'subscriptionId', record_id);
    END IF;
  ELSIF resource_type = 'podcast-subscription' THEN
    IF TG_OP = 'DELETE' THEN
      payload := jsonb_build_object('podcastId', OLD."podcastId", 'subscriptionId', record_id);
    ELSE
      payload := jsonb_build_object('podcastId', NEW."podcastId", 'subscriptionId', record_id);
    END IF;
  ELSIF resource_type = 'notification-preference' THEN
    IF TG_OP = 'DELETE' THEN
      payload := jsonb_build_object('channel', OLD."channel", 'topic', OLD."topic");
    ELSE
      payload := jsonb_build_object('channel', NEW."channel", 'topic', NEW."topic");
    END IF;
  END IF;
  PERFORM "append_user_sync_event"(owner_id, resource_type, record_id, event_action, version, payload);
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "UserSyncEvent_article_state"
AFTER INSERT OR UPDATE OR DELETE ON "ArticleState"
FOR EACH ROW EXECUTE FUNCTION "sync_article_state_change"();
CREATE TRIGGER "UserSyncEvent_suppress_user_delete"
BEFORE DELETE ON "User"
FOR EACH ROW EXECUTE FUNCTION "suppress_user_sync_events_on_delete"();
CREATE TRIGGER "UserSyncEvent_collection_item"
AFTER INSERT OR UPDATE OR DELETE ON "ArticleCollectionItem"
FOR EACH ROW EXECUTE FUNCTION "sync_collection_item_change"();
CREATE TRIGGER "UserSyncEvent_podcast_episode_state"
AFTER INSERT OR UPDATE OR DELETE ON "PodcastEpisodeState"
FOR EACH ROW EXECUTE FUNCTION "sync_podcast_episode_state_change"();
CREATE TRIGGER "UserSyncEvent_saved_search"
AFTER INSERT OR UPDATE OR DELETE ON "SavedSearch"
FOR EACH ROW EXECUTE FUNCTION "sync_user_owned_row_change"('saved-view');
CREATE TRIGGER "UserSyncEvent_feed_subscription"
AFTER INSERT OR UPDATE OR DELETE ON "FeedSubscription"
FOR EACH ROW EXECUTE FUNCTION "sync_user_owned_row_change"('feed-subscription');
CREATE TRIGGER "UserSyncEvent_podcast_subscription"
AFTER INSERT OR UPDATE OR DELETE ON "PodcastSubscription"
FOR EACH ROW EXECUTE FUNCTION "sync_user_owned_row_change"('podcast-subscription');
CREATE TRIGGER "UserSyncEvent_smart_digest"
AFTER INSERT OR UPDATE OR DELETE ON "SmartDigest"
FOR EACH ROW EXECUTE FUNCTION "sync_user_owned_row_change"('briefing');
CREATE TRIGGER "UserSyncEvent_notification_preference"
AFTER INSERT OR UPDATE OR DELETE ON "UserNotificationPreference"
FOR EACH ROW EXECUTE FUNCTION "sync_user_owned_row_change"('notification-preference');

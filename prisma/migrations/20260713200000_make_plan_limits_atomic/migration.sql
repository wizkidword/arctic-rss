-- Keep plan-limit counters in a per-user row. Conditional updates lock that
-- row, so concurrent feed, podcast, and Smart Digest writes cannot overshoot
-- the configured allowance.

CREATE TABLE "UserPlanQuota" (
  "userId" TEXT NOT NULL,
  "sourceCount" INTEGER NOT NULL DEFAULT 0,
  "enabledSmartDigestCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserPlanQuota_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "UserPlanQuota_sourceCount_nonnegative" CHECK ("sourceCount" >= 0),
  CONSTRAINT "UserPlanQuota_enabledSmartDigestCount_nonnegative" CHECK ("enabledSmartDigestCount" >= 0)
);

-- Take short write locks before the initial count so no subscription or rule
-- can be committed between the backfill and trigger installation below.
LOCK TABLE "User", "FeedSubscription", "PodcastSubscription", "SmartDigestRule"
IN SHARE ROW EXCLUSIVE MODE;

INSERT INTO "UserPlanQuota" (
  "userId",
  "sourceCount",
  "enabledSmartDigestCount",
  "createdAt",
  "updatedAt"
)
SELECT
  user_row."id",
  (SELECT COUNT(*) FROM "FeedSubscription" WHERE "userId" = user_row."id") +
    (SELECT COUNT(*) FROM "PodcastSubscription" WHERE "userId" = user_row."id"),
  (SELECT COUNT(*) FROM "SmartDigestRule" WHERE "userId" = user_row."id" AND "isEnabled"),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "User" AS user_row;

ALTER TABLE "UserPlanQuota"
ADD CONSTRAINT "UserPlanQuota_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE FUNCTION "UserPlanQuota_track_source"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  current_plan "Plan";
  updated_count INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO "UserPlanQuota" ("userId", "createdAt", "updatedAt")
    VALUES (NEW."userId", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("userId") DO NOTHING;

    SELECT "plan"
    INTO current_plan
    FROM "User"
    WHERE "id" = NEW."userId";

    IF current_plan = 'FREE' THEN
      UPDATE "UserPlanQuota"
      SET
        "sourceCount" = "sourceCount" + 1,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "userId" = NEW."userId"
        AND "sourceCount" < 200
      RETURNING "sourceCount" INTO updated_count;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'ARCTIC_RSS_SOURCE_LIMIT_REACHED' USING ERRCODE = 'P0001';
      END IF;
    ELSE
      UPDATE "UserPlanQuota"
      SET
        "sourceCount" = "sourceCount" + 1,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "userId" = NEW."userId";
    END IF;

    RETURN NEW;
  END IF;

  UPDATE "UserPlanQuota"
  SET
    "sourceCount" = GREATEST("sourceCount" - 1, 0),
    "updatedAt" = CURRENT_TIMESTAMP
  WHERE "userId" = OLD."userId";

  RETURN OLD;
END;
$$;

CREATE FUNCTION "UserPlanQuota_reject_source_owner_change"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."userId" IS DISTINCT FROM OLD."userId" THEN
    RAISE EXCEPTION 'Subscription ownership cannot change.' USING ERRCODE = '55000';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "UserPlanQuota_track_feed_subscription"
BEFORE INSERT OR DELETE ON "FeedSubscription"
FOR EACH ROW
EXECUTE FUNCTION "UserPlanQuota_track_source"();

CREATE TRIGGER "UserPlanQuota_track_podcast_subscription"
BEFORE INSERT OR DELETE ON "PodcastSubscription"
FOR EACH ROW
EXECUTE FUNCTION "UserPlanQuota_track_source"();

CREATE TRIGGER "UserPlanQuota_reject_feed_subscription_owner_change"
BEFORE UPDATE OF "userId" ON "FeedSubscription"
FOR EACH ROW
EXECUTE FUNCTION "UserPlanQuota_reject_source_owner_change"();

CREATE TRIGGER "UserPlanQuota_reject_podcast_subscription_owner_change"
BEFORE UPDATE OF "userId" ON "PodcastSubscription"
FOR EACH ROW
EXECUTE FUNCTION "UserPlanQuota_reject_source_owner_change"();

CREATE FUNCTION "UserPlanQuota_track_smart_digest"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  current_plan "Plan";
  updated_count INTEGER;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW."userId" IS DISTINCT FROM OLD."userId" THEN
    RAISE EXCEPTION 'Smart Digest ownership cannot change.' USING ERRCODE = '55000';
  END IF;

  IF (TG_OP = 'INSERT' AND NEW."isEnabled")
     OR (TG_OP = 'UPDATE' AND NOT OLD."isEnabled" AND NEW."isEnabled") THEN
    INSERT INTO "UserPlanQuota" ("userId", "createdAt", "updatedAt")
    VALUES (NEW."userId", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("userId") DO NOTHING;

    SELECT "plan"
    INTO current_plan
    FROM "User"
    WHERE "id" = NEW."userId";

    IF current_plan = 'FREE' THEN
      UPDATE "UserPlanQuota"
      SET
        "enabledSmartDigestCount" = "enabledSmartDigestCount" + 1,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "userId" = NEW."userId"
        AND "enabledSmartDigestCount" < 1
      RETURNING "enabledSmartDigestCount" INTO updated_count;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'ARCTIC_RSS_SMART_DIGEST_LIMIT_REACHED' USING ERRCODE = 'P0001';
      END IF;
    ELSIF current_plan = 'PRO' THEN
      UPDATE "UserPlanQuota"
      SET
        "enabledSmartDigestCount" = "enabledSmartDigestCount" + 1,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "userId" = NEW."userId"
        AND "enabledSmartDigestCount" < 10
      RETURNING "enabledSmartDigestCount" INTO updated_count;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'ARCTIC_RSS_SMART_DIGEST_LIMIT_REACHED' USING ERRCODE = 'P0001';
      END IF;
    ELSE
      UPDATE "UserPlanQuota"
      SET
        "enabledSmartDigestCount" = "enabledSmartDigestCount" + 1,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "userId" = NEW."userId";
    END IF;

    RETURN NEW;
  END IF;

  IF (TG_OP = 'DELETE' AND OLD."isEnabled")
     OR (TG_OP = 'UPDATE' AND OLD."isEnabled" AND NOT NEW."isEnabled") THEN
    UPDATE "UserPlanQuota"
    SET
      "enabledSmartDigestCount" = GREATEST("enabledSmartDigestCount" - 1, 0),
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "userId" = OLD."userId";
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "UserPlanQuota_track_smart_digest"
BEFORE INSERT OR DELETE OR UPDATE OF "isEnabled", "userId" ON "SmartDigestRule"
FOR EACH ROW
EXECUTE FUNCTION "UserPlanQuota_track_smart_digest"();

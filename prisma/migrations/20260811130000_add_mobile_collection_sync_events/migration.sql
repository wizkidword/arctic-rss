-- Collection lifecycle changes need their own coarse invalidation event. Item
-- deletes cascaded from a collection deletion remain intentionally suppressed;
-- the collection tombstone tells mobile clients to discard collection-derived
-- cache without implying that every child tombstone was individually emitted.
CREATE OR REPLACE FUNCTION "sync_article_collection_change"() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('arctic_rss.deleting_user_id', true) = OLD."userId" THEN
    RETURN OLD;
  END IF;
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM "User" WHERE "id" = OLD."userId") THEN
    RETURN OLD;
  END IF;
  IF TG_OP = 'DELETE' THEN
    PERFORM "append_user_sync_event"(
      OLD."userId",
      'collection',
      OLD."id",
      'TOMBSTONE',
      OLD."updatedAt"::TEXT,
      jsonb_build_object('collectionId', OLD."id")
    );
    RETURN OLD;
  END IF;

  PERFORM "append_user_sync_event"(
    NEW."userId",
    'collection',
    NEW."id",
    'UPSERT',
    NEW."updatedAt"::TEXT,
    jsonb_build_object(
      'collectionId', NEW."id",
      'name', NEW."name",
      'sortOrder', NEW."sortOrder"
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "UserSyncEvent_collection"
AFTER INSERT OR UPDATE OR DELETE ON "ArticleCollection"
FOR EACH ROW EXECUTE FUNCTION "sync_article_collection_change"();

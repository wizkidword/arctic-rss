-- Collection names are user-facing labels. Normalize their comparison so
-- capitalization and runs of whitespace cannot create confusing duplicates.
CREATE UNIQUE INDEX "ArticleCollection_userId_normalizedName_key"
ON "ArticleCollection" (
  "userId",
  lower(regexp_replace(btrim("name"), '[[:space:]]+', ' ', 'g'))
);

-- Collections are inexpensive but unbounded creation is administrative noise.
-- Serialize the uncommon creation path so concurrent requests cannot pass the
-- count check together.
CREATE OR REPLACE FUNCTION "enforce_article_collection_limit"()
RETURNS TRIGGER AS $$
BEGIN
  LOCK TABLE "ArticleCollection" IN SHARE ROW EXCLUSIVE MODE;

  IF (
    SELECT COUNT(*)
    FROM "ArticleCollection"
    WHERE "userId" = NEW."userId"
  ) >= 100 THEN
    RAISE EXCEPTION 'ARCTIC_RSS_COLLECTION_LIMIT_REACHED';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ArticleCollection_enforce_limit"
BEFORE INSERT ON "ArticleCollection"
FOR EACH ROW
EXECUTE FUNCTION "enforce_article_collection_limit"();

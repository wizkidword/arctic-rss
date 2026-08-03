-- Keep the full-text document in PostgreSQL so reader search does not rebuild
-- the same weighted vector for matching and ranking every candidate row.
-- Build the replacement index before removing the expression index so the
-- migration preserves an indexed search path until the staged app swap.
ALTER TABLE "Article"
  ADD COLUMN "searchDocument" tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple'::regconfig, coalesce("title", '')), 'A')
    || setweight(to_tsvector('simple'::regconfig, coalesce("author", '')), 'B')
    || setweight(to_tsvector('simple'::regconfig, coalesce("summary", '')), 'C')
    || setweight(to_tsvector('simple'::regconfig, coalesce("contentText", '')), 'D')
  ) STORED;

CREATE INDEX "Article_searchDocument_stored_idx"
  ON "Article" USING GIN ("searchDocument");

DROP INDEX "Article_searchDocument_idx";

ALTER INDEX "Article_searchDocument_stored_idx"
  RENAME TO "Article_searchDocument_idx";

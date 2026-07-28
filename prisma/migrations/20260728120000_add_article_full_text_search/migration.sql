-- Article search is deliberately indexed on the shared article record. User
-- visibility remains enforced by the query through FeedSubscription and
-- ArticleState; user-specific folder and source labels are never copied here.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "Article_searchDocument_idx"
  ON "Article" USING GIN ((
    setweight(to_tsvector('simple'::regconfig, coalesce("title", '')), 'A')
    || setweight(to_tsvector('simple'::regconfig, coalesce("author", '')), 'B')
    || setweight(to_tsvector('simple'::regconfig, coalesce("summary", '')), 'C')
    || setweight(to_tsvector('simple'::regconfig, coalesce("contentText", '')), 'D')
  ));

CREATE INDEX "Feed_title_trgm_idx"
  ON "Feed" USING GIN ("title" gin_trgm_ops);

CREATE INDEX "FeedSubscription_customTitle_trgm_idx"
  ON "FeedSubscription" USING GIN ("customTitle" gin_trgm_ops)
  WHERE "customTitle" IS NOT NULL;

CREATE INDEX "Folder_name_trgm_idx"
  ON "Folder" USING GIN ("name" gin_trgm_ops);

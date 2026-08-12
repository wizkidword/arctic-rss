-- Pending approvals issued before this migration were not bound to a browser
-- session. They are short-lived, but invalidating them is the only safe way to
-- add the binding without accepting a synthetic or globally shared value.
DELETE FROM "MobileAuthorizationRequest";

ALTER TABLE "MobileAuthorizationRequest"
ADD COLUMN "browserSessionHash" VARCHAR(64) NOT NULL;

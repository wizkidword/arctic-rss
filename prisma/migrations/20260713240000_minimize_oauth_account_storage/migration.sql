-- Arctic RSS uses Google only to establish identity at sign-in. It never uses
-- Google API access after authentication, so retaining OAuth credentials adds
-- risk without providing product value. Dropping these columns permanently
-- removes the eight existing credential records and prevents future storage.
ALTER TABLE "Account"
  DROP COLUMN "refresh_token",
  DROP COLUMN "access_token",
  DROP COLUMN "expires_at",
  DROP COLUMN "token_type",
  DROP COLUMN "scope",
  DROP COLUMN "id_token",
  DROP COLUMN "session_state";

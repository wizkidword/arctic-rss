-- A stored period keeps queued AI briefings faithful to the window a reader chose.
CREATE TYPE "AiDigestPeriod" AS ENUM ('DAILY', 'WEEKLY');

ALTER TABLE "AiDigest"
  ADD COLUMN "period" "AiDigestPeriod" NOT NULL DEFAULT 'DAILY';

CREATE INDEX "AiDigest_userId_period_createdAt_idx"
  ON "AiDigest"("userId", "period", "createdAt");

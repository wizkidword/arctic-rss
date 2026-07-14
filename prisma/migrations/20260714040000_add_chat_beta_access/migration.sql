-- Revocable operator-managed access for the native-chat private beta.
-- This migration is additive and is intentionally not applied by local work.
CREATE TABLE "ChatBetaAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantedByUserId" TEXT,
    "note" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatBetaAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChatBetaAccess_userId_key" ON "ChatBetaAccess"("userId");
CREATE INDEX "ChatBetaAccess_revokedAt_createdAt_idx" ON "ChatBetaAccess"("revokedAt", "createdAt");

ALTER TABLE "ChatBetaAccess"
  ADD CONSTRAINT "ChatBetaAccess_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatBetaAccess"
  ADD CONSTRAINT "ChatBetaAccess_grantedByUserId_fkey"
  FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

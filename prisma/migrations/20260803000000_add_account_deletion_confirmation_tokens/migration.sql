-- OAuth-only deletion confirmations store only a one-way token digest and
-- cascade with the account once the deletion transaction completes.
CREATE TABLE "AccountDeletionConfirmationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "authVersion" INTEGER NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'ACCOUNT_DELETION',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountDeletionConfirmationToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccountDeletionConfirmationToken_tokenHash_key"
  ON "AccountDeletionConfirmationToken"("tokenHash");
CREATE INDEX "AccountDeletionConfirmationToken_userId_createdAt_idx"
  ON "AccountDeletionConfirmationToken"("userId", "createdAt");
CREATE INDEX "AccountDeletionConfirmationToken_expiresAt_idx"
  ON "AccountDeletionConfirmationToken"("expiresAt");

ALTER TABLE "AccountDeletionConfirmationToken"
  ADD CONSTRAINT "AccountDeletionConfirmationToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

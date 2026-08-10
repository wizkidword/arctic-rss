-- Mobile authorization codes and refresh sessions are separate from Auth.js
-- browser sessions. Both raw credential types are represented only by hashes.
CREATE TABLE "DeviceAuthorizationCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "codeChallenge" TEXT NOT NULL,
    "codeChallengeMethod" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "nonceHash" TEXT NOT NULL,
    "deviceName" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "appVersion" TEXT NOT NULL,
    "authVersion" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceAuthorizationCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeviceAuthorizationCode_codeHash_key"
  ON "DeviceAuthorizationCode"("codeHash");
CREATE INDEX "DeviceAuthorizationCode_userId_createdAt_idx"
  ON "DeviceAuthorizationCode"("userId", "createdAt");
CREATE INDEX "DeviceAuthorizationCode_expiresAt_idx"
  ON "DeviceAuthorizationCode"("expiresAt");

ALTER TABLE "DeviceAuthorizationCode"
  ADD CONSTRAINT "DeviceAuthorizationCode_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DeviceSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenFamilyId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "deviceName" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "appVersion" TEXT NOT NULL,
    "authVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL,
    "accessIssuedAt" TIMESTAMP(3) NOT NULL,
    "refreshExpiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedById" TEXT,
    "reuseDetectedAt" TIMESTAMP(3),

    CONSTRAINT "DeviceSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeviceSession_refreshTokenHash_key"
  ON "DeviceSession"("refreshTokenHash");
CREATE UNIQUE INDEX "DeviceSession_replacedById_key"
  ON "DeviceSession"("replacedById");
CREATE INDEX "DeviceSession_userId_revokedAt_replacedById_idx"
  ON "DeviceSession"("userId", "revokedAt", "replacedById");
CREATE INDEX "DeviceSession_tokenFamilyId_idx"
  ON "DeviceSession"("tokenFamilyId");
CREATE INDEX "DeviceSession_refreshExpiresAt_idx"
  ON "DeviceSession"("refreshExpiresAt");

ALTER TABLE "DeviceSession"
  ADD CONSTRAINT "DeviceSession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeviceSession"
  ADD CONSTRAINT "DeviceSession_replacedById_fkey"
  FOREIGN KEY ("replacedById") REFERENCES "DeviceSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

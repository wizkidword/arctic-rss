-- Add an explicit, one-time browser approval record for native authorization.
-- Existing authorization codes remain valid for their original short lifetime;
-- new exchanges bind the code to the registered public client identifier.
ALTER TABLE "DeviceAuthorizationCode" ADD COLUMN "clientId" VARCHAR(128);

CREATE TABLE "MobileAuthorizationRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" VARCHAR(128) NOT NULL,
    "redirectUri" VARCHAR(500) NOT NULL,
    "codeChallenge" VARCHAR(256) NOT NULL,
    "codeChallengeMethod" VARCHAR(16) NOT NULL,
    "nonceHash" VARCHAR(64) NOT NULL,
    "state" VARCHAR(512) NOT NULL,
    "approvalTokenHash" VARCHAR(64) NOT NULL,
    "deviceName" VARCHAR(120) NOT NULL,
    "platform" VARCHAR(32) NOT NULL,
    "appVersion" VARCHAR(80) NOT NULL,
    "authVersion" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MobileAuthorizationRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MobileAuthorizationRequest_approvalTokenHash_key"
ON "MobileAuthorizationRequest"("approvalTokenHash");

CREATE INDEX "MobileAuthorizationRequest_userId_expiresAt_idx"
ON "MobileAuthorizationRequest"("userId", "expiresAt");

CREATE INDEX "MobileAuthorizationRequest_expiresAt_idx"
ON "MobileAuthorizationRequest"("expiresAt");

ALTER TABLE "MobileAuthorizationRequest"
ADD CONSTRAINT "MobileAuthorizationRequest_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

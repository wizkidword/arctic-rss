-- External IRC remains disabled by feature flags. These records intentionally
-- contain neither credentials nor remote message history.

CREATE TYPE "ExternalIrcConnectionState" AS ENUM ('DISCONNECTED', 'CONNECTING', 'CONNECTED', 'BACKING_OFF', 'DISABLED');

CREATE TABLE "ExternalIrcIdentity" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "networkId" TEXT NOT NULL,
  "nickname" TEXT NOT NULL,
  "nicknameNormalized" TEXT NOT NULL,
  "connectionState" "ExternalIrcConnectionState" NOT NULL DEFAULT 'DISCONNECTED',
  "lastConnectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExternalIrcIdentity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExternalIrcFavorite" (
  "id" TEXT NOT NULL,
  "identityId" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "normalized" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExternalIrcFavorite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExternalIrcIdentity_userId_networkId_key" ON "ExternalIrcIdentity"("userId", "networkId");
CREATE INDEX "ExternalIrcIdentity_networkId_connectionState_idx" ON "ExternalIrcIdentity"("networkId", "connectionState");
CREATE UNIQUE INDEX "ExternalIrcFavorite_identityId_normalized_key" ON "ExternalIrcFavorite"("identityId", "normalized");
CREATE INDEX "ExternalIrcFavorite_normalized_idx" ON "ExternalIrcFavorite"("normalized");

ALTER TABLE "ExternalIrcIdentity" ADD CONSTRAINT "ExternalIrcIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExternalIrcFavorite" ADD CONSTRAINT "ExternalIrcFavorite_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "ExternalIrcIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Expand-only stable mobile-device identity. Refresh-token rows remain the
-- historical source of truth until a later reviewed dual-read cutover.
CREATE TABLE "MobileDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenFamilyId" TEXT NOT NULL,
    "deviceName" VARCHAR(120) NOT NULL,
    "platform" VARCHAR(32) NOT NULL,
    "appVersion" VARCHAR(80) NOT NULL,
    "authVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL,
    "refreshExpiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "reuseDetectedAt" TIMESTAMP(3),

    CONSTRAINT "MobileDevice_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DeviceSession" ADD COLUMN "mobileDeviceId" TEXT;

CREATE UNIQUE INDEX "MobileDevice_tokenFamilyId_key" ON "MobileDevice"("tokenFamilyId");
CREATE INDEX "MobileDevice_userId_revokedAt_refreshExpiresAt_idx"
ON "MobileDevice"("userId", "revokedAt", "refreshExpiresAt");
CREATE INDEX "MobileDevice_refreshExpiresAt_idx" ON "MobileDevice"("refreshExpiresAt");
CREATE INDEX "DeviceSession_mobileDeviceId_idx" ON "DeviceSession"("mobileDeviceId");

-- Backfill one stable record per pre-existing token family. The chosen row is
-- the newest refresh row; state is folded across the family below.
INSERT INTO "MobileDevice" (
    "id", "userId", "tokenFamilyId", "deviceName", "platform", "appVersion",
    "authVersion", "createdAt", "lastUsedAt", "refreshExpiresAt", "revokedAt", "reuseDetectedAt"
)
SELECT DISTINCT ON ("tokenFamilyId")
    'legacy_mobile_' || md5("tokenFamilyId"),
    "userId", "tokenFamilyId", "deviceName", "platform", "appVersion",
    "authVersion", "createdAt", "lastUsedAt", "refreshExpiresAt", "revokedAt", "reuseDetectedAt"
FROM "DeviceSession"
ORDER BY "tokenFamilyId", "lastUsedAt" DESC, "createdAt" DESC, "id" DESC;

-- Preserve any earlier reuse/revocation/expiry evidence from family history.
UPDATE "MobileDevice" AS md
SET
    "revokedAt" = aggregate."revokedAt",
    "reuseDetectedAt" = aggregate."reuseDetectedAt",
    "lastUsedAt" = aggregate."lastUsedAt",
    "refreshExpiresAt" = aggregate."refreshExpiresAt"
FROM (
    SELECT
        "tokenFamilyId",
        MAX("revokedAt") AS "revokedAt",
        MAX("reuseDetectedAt") AS "reuseDetectedAt",
        MAX("lastUsedAt") AS "lastUsedAt",
        MAX("refreshExpiresAt") AS "refreshExpiresAt"
    FROM "DeviceSession"
    GROUP BY "tokenFamilyId"
) AS aggregate
WHERE md."tokenFamilyId" = aggregate."tokenFamilyId";

UPDATE "DeviceSession" AS session
SET "mobileDeviceId" = device."id"
FROM "MobileDevice" AS device
WHERE session."tokenFamilyId" = device."tokenFamilyId";

ALTER TABLE "MobileDevice"
ADD CONSTRAINT "MobileDevice_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DeviceSession"
ADD CONSTRAINT "DeviceSession_mobileDeviceId_fkey"
FOREIGN KEY ("mobileDeviceId") REFERENCES "MobileDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

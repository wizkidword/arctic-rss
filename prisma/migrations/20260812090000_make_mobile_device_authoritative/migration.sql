-- Make the stable MobileDevice the authoritative lifecycle owner for mobile
-- mutation receipts and installations. A rotating DeviceSession remains only
-- optional audit context, so session-history retention cannot remove either
-- record class.

UPDATE "DeviceMutationReceipt" AS receipt
SET "mobileDeviceId" = session."mobileDeviceId"
FROM "DeviceSession" AS session
WHERE receipt."mobileDeviceId" IS NULL
  AND receipt."deviceSessionId" = session."id"
  AND session."mobileDeviceId" IS NOT NULL;

UPDATE "DeviceInstallation" AS installation
SET "mobileDeviceId" = session."mobileDeviceId"
FROM "DeviceSession" AS session
WHERE installation."mobileDeviceId" IS NULL
  AND installation."deviceSessionId" = session."id"
  AND session."mobileDeviceId" IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "DeviceMutationReceipt" AS receipt
    LEFT JOIN "MobileDevice" AS device ON device."id" = receipt."mobileDeviceId"
    LEFT JOIN "DeviceSession" AS session ON session."id" = receipt."deviceSessionId"
    WHERE receipt."mobileDeviceId" IS NULL
       OR device."id" IS NULL
       OR (session."id" IS NOT NULL AND session."userId" <> device."userId")
  ) THEN
    RAISE EXCEPTION
      'Cannot make MobileDevice authoritative: a mutation receipt is missing a valid same-user stable device';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "DeviceInstallation" AS installation
    LEFT JOIN "MobileDevice" AS device ON device."id" = installation."mobileDeviceId"
    LEFT JOIN "DeviceSession" AS session ON session."id" = installation."deviceSessionId"
    WHERE installation."mobileDeviceId" IS NULL
       OR device."id" IS NULL
       OR (session."id" IS NOT NULL AND session."userId" <> device."userId")
  ) THEN
    RAISE EXCEPTION
      'Cannot make MobileDevice authoritative: an installation is missing a valid same-user stable device';
  END IF;
END $$;

ALTER TABLE "DeviceMutationReceipt"
  DROP CONSTRAINT IF EXISTS "DeviceMutationReceipt_deviceSessionId_fkey",
  DROP CONSTRAINT IF EXISTS "DeviceMutationReceipt_mobileDeviceId_fkey";
ALTER TABLE "DeviceInstallation"
  DROP CONSTRAINT IF EXISTS "DeviceInstallation_deviceSessionId_fkey",
  DROP CONSTRAINT IF EXISTS "DeviceInstallation_mobileDeviceId_fkey";

ALTER TABLE "DeviceMutationReceipt"
  ALTER COLUMN "mobileDeviceId" SET NOT NULL,
  ALTER COLUMN "deviceSessionId" DROP NOT NULL;
ALTER TABLE "DeviceInstallation"
  ALTER COLUMN "mobileDeviceId" SET NOT NULL,
  ALTER COLUMN "deviceSessionId" DROP NOT NULL;

DROP INDEX IF EXISTS "DeviceMutationReceipt_deviceSessionId_idempotencyKeyHash_key";
DROP INDEX IF EXISTS "DeviceInstallation_deviceSessionId_disabledAt_idx";

ALTER TABLE "DeviceMutationReceipt"
  ADD CONSTRAINT "DeviceMutationReceipt_mobileDeviceId_fkey"
    FOREIGN KEY ("mobileDeviceId") REFERENCES "MobileDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "DeviceMutationReceipt_deviceSessionId_fkey"
    FOREIGN KEY ("deviceSessionId") REFERENCES "DeviceSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DeviceInstallation"
  ADD CONSTRAINT "DeviceInstallation_mobileDeviceId_fkey"
    FOREIGN KEY ("mobileDeviceId") REFERENCES "MobileDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "DeviceInstallation_deviceSessionId_fkey"
    FOREIGN KEY ("deviceSessionId") REFERENCES "DeviceSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

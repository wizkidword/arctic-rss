-- Expand receipt and installation ownership to the stable mobile device while
-- retaining their existing DeviceSession compatibility relations.
ALTER TABLE "DeviceMutationReceipt" ADD COLUMN "mobileDeviceId" TEXT;
ALTER TABLE "DeviceInstallation" ADD COLUMN "mobileDeviceId" TEXT;

UPDATE "DeviceMutationReceipt" AS receipt
SET "mobileDeviceId" = session."mobileDeviceId"
FROM "DeviceSession" AS session
WHERE receipt."deviceSessionId" = session."id";

UPDATE "DeviceInstallation" AS installation
SET "mobileDeviceId" = session."mobileDeviceId"
FROM "DeviceSession" AS session
WHERE installation."deviceSessionId" = session."id";

CREATE UNIQUE INDEX "DeviceMutationReceipt_mobileDeviceId_idempotencyKeyHash_key"
ON "DeviceMutationReceipt"("mobileDeviceId", "idempotencyKeyHash");
CREATE INDEX "DeviceMutationReceipt_mobileDeviceId_idx" ON "DeviceMutationReceipt"("mobileDeviceId");
CREATE INDEX "DeviceInstallation_mobileDeviceId_disabledAt_idx"
ON "DeviceInstallation"("mobileDeviceId", "disabledAt");

ALTER TABLE "DeviceMutationReceipt"
ADD CONSTRAINT "DeviceMutationReceipt_mobileDeviceId_fkey"
FOREIGN KEY ("mobileDeviceId") REFERENCES "MobileDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DeviceInstallation"
ADD CONSTRAINT "DeviceInstallation_mobileDeviceId_fkey"
FOREIGN KEY ("mobileDeviceId") REFERENCES "MobileDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

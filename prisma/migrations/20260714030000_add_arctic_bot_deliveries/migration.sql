-- ArcticBot remains disabled until ARCTIC_IRC_ENABLED and
-- ARCTIC_IRC_BOT_ENABLED are both explicitly enabled. This migration stores
-- native-room delivery state only; it creates no network connection.

CREATE TYPE "ChatBotDeliveryStatus" AS ENUM ('PENDING', 'POSTED');

ALTER TABLE "ChatRoom"
  ADD COLUMN "botLastPostedAt" TIMESTAMP(3);

CREATE TABLE "ChatBotDelivery" (
  "roomId" TEXT NOT NULL,
  "articleId" TEXT NOT NULL,
  "feedId" TEXT NOT NULL,
  "status" "ChatBotDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "messageId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChatBotDelivery_pkey" PRIMARY KEY ("roomId", "articleId")
);

CREATE INDEX "ChatBotDelivery_roomId_feedId_status_createdAt_idx"
  ON "ChatBotDelivery"("roomId", "feedId", "status", "createdAt");
CREATE INDEX "ChatBotDelivery_feedId_status_createdAt_idx"
  ON "ChatBotDelivery"("feedId", "status", "createdAt");

ALTER TABLE "ChatBotDelivery"
  ADD CONSTRAINT "ChatBotDelivery_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatBotDelivery"
  ADD CONSTRAINT "ChatBotDelivery_articleId_fkey"
  FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatBotDelivery"
  ADD CONSTRAINT "ChatBotDelivery_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

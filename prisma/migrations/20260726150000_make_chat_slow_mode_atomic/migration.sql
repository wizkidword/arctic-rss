-- Slow-mode claims are stored on the member record so every gateway replica
-- conditionally advances the same durable cooldown in the message transaction.
ALTER TABLE "ChatRoomMember"
  ADD COLUMN "nextMessageAllowedAt" TIMESTAMP(3);

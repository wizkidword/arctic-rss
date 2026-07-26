-- CHAT-OUTBOX-001: Persist room events with their chat-state transaction so a
-- temporary Redis failure cannot erase a committed message or moderation event.
CREATE TABLE "ChatEventOutbox" (
  "id" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "eventType" TEXT NOT NULL,
  "aggregateType" TEXT NOT NULL,
  "aggregateId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "leaseOwner" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "deadLetteredAt" TIMESTAMP(3),
  "lastError" TEXT,

  CONSTRAINT "ChatEventOutbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChatEventOutbox_delivery_idx"
  ON "ChatEventOutbox"("deliveredAt", "deadLetteredAt", "availableAt", "leaseExpiresAt", "createdAt");
CREATE INDEX "ChatEventOutbox_aggregate_idx"
  ON "ChatEventOutbox"("aggregateType", "aggregateId", "id");

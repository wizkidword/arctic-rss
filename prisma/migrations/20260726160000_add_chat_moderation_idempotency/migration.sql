-- A moderator may retry after the server committed the change but before the
-- response reached the client. Keep one durable response receipt per actor/key
-- so the state mutation and its audit log cannot be applied twice.
CREATE TABLE "ChatModerationAction" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "result" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ChatModerationAction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChatModerationAction_actorUserId_idempotencyKey_key"
  ON "ChatModerationAction"("actorUserId", "idempotencyKey");

CREATE INDEX "ChatModerationAction_createdAt_idx"
  ON "ChatModerationAction"("createdAt");

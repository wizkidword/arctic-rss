-- CHAT-MOD-002: fail closed if historical active legal-hold duplicates have
-- not been reconciled before deployment. The release preflight documents the
-- duplicate query; this migration never picks a winner or deletes evidence.
CREATE UNIQUE INDEX "chat_legal_hold_one_active"
  ON "ChatLegalHold"("subjectType", "subjectId")
  WHERE "releasedAt" IS NULL;
